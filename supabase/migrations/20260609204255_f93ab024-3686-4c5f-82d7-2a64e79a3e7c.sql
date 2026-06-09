-- 1. Garantir que as colunas existam na tabela customers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'credits_used') THEN
        ALTER TABLE public.customers ADD COLUMN credits_used NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'cashback_used') THEN
        ALTER TABLE public.customers ADD COLUMN cashback_used NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- 2. Atualizar a função handle_appointment_completion para registrar o uso histórico
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_profile RECORD;
    v_cashback_amount NUMERIC(10,2) := 0;
    v_expires_at TIMESTAMP WITH TIME ZONE := NULL;
    v_base_amount NUMERIC(10,2);
    v_loyalty_points INTEGER;
    v_loyalty_reward_value NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        
        -- A. Incrementar pontos de fidelidade
        UPDATE public.customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
            total_spent = COALESCE(total_spent, 0) + COALESCE(NEW.total_price, 0),
            lifetime_value = COALESCE(lifetime_value, 0) + COALESCE(NEW.total_price, 0)
        WHERE id = NEW.customer_id
        RETURNING loyalty_points INTO v_loyalty_points;

        -- B. Registrar uso histórico de Créditos e Cashback
        v_credits_used := COALESCE(NEW.credits_used, NEW.credit_used, 0);
        v_cashback_used := COALESCE(NEW.cashback_used, 0);

        IF v_credits_used > 0 OR v_cashback_used > 0 THEN
            UPDATE public.customers
            SET credits_used = COALESCE(credits_used, 0) + v_credits_used,
                cashback_used = COALESCE(cashback_used, 0) + v_cashback_used
            WHERE id = NEW.customer_id;
        END IF;

        -- C. Carregar configurações do tenant
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- D. Regra de Fidelidade (10 atendimentos)
        IF v_loyalty_points >= 10 THEN
            UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;
            v_loyalty_reward_value := COALESCE(v_profile.loyalty_reward_value, 10.00);
            
            IF v_loyalty_reward_value > 0 THEN
                INSERT INTO public.customer_credits (
                    tenant_id, customer_id, appointment_id, amount, used_amount, status, credit_type, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, v_loyalty_reward_value, 0, 'available', 'loyalty', 'Prêmio de Fidelidade: 10 Atendimentos'
                );
                
                INSERT INTO public.credit_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', v_loyalty_reward_value, 'Crédito de fidelidade concedido'
                );

                UPDATE public.customers 
                SET credits = COALESCE(credits, 0) + v_loyalty_reward_value,
                    credit_balance = COALESCE(credit_balance, 0) + v_loyalty_reward_value
                WHERE id = NEW.customer_id;
            END IF;
        END IF;

        -- E. Cashback
        IF v_profile.cashback_enabled = true THEN
            IF NOT EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = NEW.id AND credit_type = 'cashback') THEN
                -- Base do cashback é o valor PAGO (não inclui o que já foi pago com créditos/cashback)
                v_base_amount := COALESCE(NEW.final_amount, NEW.amount_paid, 0);
                
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
                            tenant_id, customer_id, appointment_id, amount, used_amount, status, credit_type, expires_at
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, v_cashback_amount, 0, 'available', 'cashback', v_expires_at
                        );

                        UPDATE public.appointments SET cashback_earned = v_cashback_amount WHERE id = NEW.id;

                        UPDATE public.customers
                        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
                        WHERE id = NEW.customer_id;

                        INSERT INTO public.cashback_transactions (
                            tenant_id, customer_id, appointment_id, type, amount, description
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', v_cashback_amount, 'Cashback gerado no atendimento'
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar a função complete_appointment para ser mais rigorosa com pagamentos mistos
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT,
    p_changed_by_id UUID,
    p_source TEXT DEFAULT 'frontend',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
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
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- Extração precisa de valores
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, (p_metadata->>'card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Se for pagamento 100% Pix/Dinheiro e os valores estão 0, preenchemos
    IF v_payment_method = 'pix' AND v_pix_amount = 0 AND v_credit_used = 0 AND v_cashback_used = 0 THEN
        v_pix_amount := v_appt.total_price;
    ELSIF v_payment_method = 'cash' AND v_cash_amount = 0 AND v_credit_used = 0 AND v_cashback_used = 0 THEN
        v_cash_amount := v_appt.total_price;
    END IF;

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    
    -- Descrição detalhada para o financeiro
    v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');
    IF v_credit_used > 0 THEN v_description := v_description || ' (Créditos: R$ ' || v_credit_used || ')'; END IF;
    IF v_cashback_used > 0 THEN v_description := v_description || ' (Cashback: R$ ' || v_cashback_used || ')'; END IF;

    -- Registrar transação de entrada (Apenas valor real)
    IF v_final_amount > 0 THEN
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
                'pix', v_pix_amount, 'cash', v_cash_amount, 
                'card', v_card_amount, 'credits', v_credit_used, 
                'cashback', v_cashback_used
            )
        ) RETURNING id INTO v_trans_id;
    END IF;

    -- Registrar débito de cashback se utilizado
    IF v_cashback_used > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'debit', v_cashback_used, 'Cashback utilizado no agendamento'
        );
    END IF;

    -- Registrar débito de crédito se utilizado
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'debit', v_credit_used, 'Crédito utilizado no agendamento'
        );
    END IF;

    -- Atualizar Agendamento
    UPDATE public.appointments
    SET
        status = 'completed',
        payment_status = v_payment_status,
        completed_at = now(),
        completed_by = p_changed_by_id,
        updated_at = now(),
        credits_used = v_credit_used,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        payment_method = v_payment_method,
        payment_breakdown = jsonb_build_object(
            'pix', v_pix_amount, 'cash', v_cash_amount, 
            'card', v_card_amount, 'credits', v_credit_used, 
            'cashback', v_cashback_used
        )
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_trans_id);
END;
$$ LANGUAGE plpgsql;
