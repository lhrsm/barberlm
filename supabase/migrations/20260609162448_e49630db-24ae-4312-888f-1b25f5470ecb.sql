-- 1. Melhorar a função de registro de Pix com idempotência robusta
CREATE OR REPLACE FUNCTION public.register_pix_payment_transaction(p_appointment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_appointment RECORD;
    v_transaction_id UUID;
    v_description TEXT;
    v_pix_amount NUMERIC;
BEGIN
    -- Obter detalhes do agendamento
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Verificar se é um pagamento Pix e se está pago/confirmado
    IF v_appointment.payment_method != 'pix' OR v_appointment.payment_status NOT IN ('paid', 'confirmed', 'completed') THEN
        RETURN;
    END IF;

    -- Calcular o valor real do Pix (descontando créditos/cashback)
    v_pix_amount := COALESCE(v_appointment.pix_amount, v_appointment.final_amount, v_appointment.amount_paid, v_appointment.total_price, 0);
    
    -- Se houver breakdown explícito, usar
    IF (v_appointment.payment_breakdown->>'pix_amount') IS NOT NULL THEN
        v_pix_amount := (v_appointment.payment_breakdown->>'pix_amount')::NUMERIC;
    END IF;

    -- BLOQUEIO DE DUPLICIDADE: Verificar se já existe transação de entrada para este agendamento
    SELECT id INTO v_transaction_id 
    FROM public.transactions 
    WHERE appointment_id = p_appointment_id 
    AND type = 'income' 
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
        -- Se já existe, apenas garantir que os valores estão sincronizados se for Pix
        UPDATE public.transactions 
        SET 
            amount = v_pix_amount, 
            pix_amount = v_pix_amount,
            payment_method = 'pix'
        WHERE id = v_transaction_id AND (payment_method IS NULL OR payment_method = 'pix');
        RETURN;
    END IF;

    v_description := 'Pagamento Pix - Agendamento Online';
    
    -- Criar a transação financeira
    INSERT INTO public.transactions (
        user_id,
        appointment_id,
        tenant_id,
        barber_id,
        type,
        category,
        amount,
        pix_amount,
        payment_method,
        description,
        date,
        manual_adjustment
    ) VALUES (
        v_appointment.user_id,
        v_appointment.id,
        v_appointment.tenant_id,
        v_appointment.barber_id,
        'income',
        'Serviço',
        v_pix_amount,
        v_pix_amount,
        'pix',
        v_description,
        CURRENT_DATE,
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corrigir RPC complete_appointment para evitar duplicidade
CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text, p_changed_by_id uuid, p_source text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_trans_id UUID;
    v_description TEXT;
BEGIN
    -- Carregar dados do agendamento
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Evitar re-conclusão
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- Extrair valores do metadata ou do agendamento
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'card_amount')::numeric, (p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Se for Pix e o valor estiver zerado, inferir
    IF v_payment_method ~* 'pix' AND v_payment_status = 'paid' AND v_pix_amount = 0 THEN
        v_pix_amount := v_appt.total_price - v_credit_used - v_cashback_used;
        IF v_pix_amount < 0 THEN v_pix_amount := 0; END IF;
    END IF;

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    v_description := 'Pagamento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');

    -- 1. REGISTRAR TRANSAÇÃO PRIMEIRO (Para que o trigger de UPDATE veja e não duplique)
    IF (v_pix_amount + v_cash_amount + v_card_amount) > 0 OR v_payment_status = 'paid' THEN
        -- Verificar se já existe para evitar erro de concorrência mesmo antes da trava física
        SELECT id INTO v_trans_id FROM public.transactions WHERE appointment_id = p_appointment_id AND type = 'income';
        
        IF v_trans_id IS NULL THEN
            INSERT INTO public.transactions (
                user_id, tenant_id, appointment_id, barber_id, type, category, 
                amount, pix_amount, cash_amount, credit_card_amount, 
                credits_amount, cashback_amount, payment_method, 
                description, date, payment_breakdown
            ) VALUES (
                v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
                v_final_amount, v_pix_amount, v_cash_amount, v_card_amount,
                v_credit_used, v_cashback_used, v_payment_method,
                v_description, CURRENT_DATE, 
                jsonb_build_object(
                    'pix_amount', v_pix_amount, 'cash_amount', v_cash_amount, 
                    'card_amount', v_card_amount, 'credits_used', v_credit_used, 
                    'cashback_used', v_cashback_used
                )
            ) RETURNING id INTO v_trans_id;
        END IF;
    END IF;

    -- 2. ATUALIZAR AGENDAMENTO
    UPDATE public.appointments
    SET
        status = 'completed',
        payment_status = v_payment_status,
        completed_at = now(),
        completed_by = p_changed_by_id,
        updated_at = now(),
        credit_used = v_credit_used,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        payment_method = v_payment_method,
        payment_breakdown = jsonb_build_object(
            'pix_amount', v_pix_amount, 'cash_amount', v_cash_amount, 
            'card_amount', v_card_amount, 'credits_used', v_credit_used, 
            'cashback_used', v_cashback_used
        )
    WHERE id = p_appointment_id;

    -- Log de status
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source, p_metadata
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_trans_id);
END;
$function$;

-- 3. Corrigir lógica de cashback na conclusão
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_profile RECORD;
    v_cashback_amount NUMERIC(10,2) := 0;
    v_expires_at TIMESTAMP WITH TIME ZONE := NULL;
    v_base_amount NUMERIC(10,2);
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        
        -- 1. Incrementar pontos de fidelidade
        UPDATE public.customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1
        WHERE id = NEW.customer_id;

        -- 2. Carregar configurações de cashback do tenant
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- 3. Verificar se cashback está habilitado
        IF v_profile.cashback_enabled = true THEN
            -- Evitar duplicidade
            IF NOT EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = NEW.id AND credit_type = 'cashback') THEN
                -- Base é o valor real pago em dinheiro/pix/cartão
                v_base_amount := COALESCE(NEW.amount_paid, NEW.final_amount, NEW.total_price, 0);
                
                IF v_base_amount >= COALESCE(v_profile.cashback_minimum_amount, 0) AND v_base_amount > 0 THEN
                    IF v_profile.cashback_type = 'fixed' THEN
                        v_cashback_amount := COALESCE(v_profile.cashback_fixed_value, 0);
                    ELSE
                        v_cashback_amount := (v_base_amount * COALESCE(v_profile.cashback_percentage, 0)) / 100;
                    END IF;

                    IF v_cashback_amount > 0 THEN
                        IF v_profile.cashback_expiration_days IS NOT NULL AND v_profile.cashback_expiration_days > 0 THEN
                            v_expires_at := now() + (v_profile.cashback_expiration_days || ' days')::interval;
                        END IF;

                        INSERT INTO public.customer_credits (
                            tenant_id, customer_id, appointment_id, amount, 
                            used_amount, status, credit_type, expires_at
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, v_cashback_amount, 
                            0, 'available', 'cashback', v_expires_at
                        );

                        UPDATE public.appointments SET cashback_earned = v_cashback_amount WHERE id = NEW.id;

                        -- CORREÇÃO: Atualizar apenas cashback_balance, NÃO credits
                        UPDATE public.customers
                        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
                        WHERE id = NEW.customer_id;

                        INSERT INTO public.cashback_transactions (
                            tenant_id, customer_id, appointment_id, type, 
                            amount, base_amount, description
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', 
                            v_cashback_amount, v_base_amount, 
                            'Cashback gerado pelo agendamento ' || NEW.id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 4. Adicionar Trava de Unicidade Lógica na tabela transactions
-- Impede que um mesmo agendamento tenha mais de uma transação de entrada (income)
-- Isso resolve definitivamente o problema de duplicidade de receita
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_income_per_appointment') THEN
        CREATE UNIQUE INDEX idx_unique_income_per_appointment ON public.transactions (appointment_id) WHERE (type = 'income' AND appointment_id IS NOT NULL);
    END IF;
END $$;
