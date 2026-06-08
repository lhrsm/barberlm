-- 1. Dropar e recriar complete_appointment para evitar erro de parâmetros default
DROP FUNCTION IF EXISTS public.complete_appointment(uuid,text,uuid,text,jsonb);

CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text,
    p_changed_by_id uuid,
    p_source text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_appt RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_payment_status TEXT;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Extrair valores do metadata ou manter atuais
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, v_appt.total_price, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', 'paid');

    UPDATE public.appointments
    SET
        status = 'completed',
        payment_status = v_payment_status,
        completed_at = now(),
        completed_by = p_changed_by_id,
        updated_at = now(),
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount
    WHERE id = p_appointment_id;

    -- Registrar log de status
    INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        changed_by_id,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'completed',
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Refinar o gatilho de cashback (já existe a função do passo anterior, apenas garantindo a versão mais robusta)
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
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
            
            -- Verificar se já existe cashback para este agendamento (evitar duplicidade)
            IF NOT EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = NEW.id AND credit_type = 'cashback') THEN
                
                -- A base do cashback é o valor efetivamente pago (final_amount / amount_paid)
                -- Isso evita gerar cashback sobre o valor pago com outros créditos
                v_base_amount := COALESCE(NEW.amount_paid, NEW.final_amount, NEW.total_price, 0);
                
                -- Verificar valor mínimo
                IF v_base_amount >= COALESCE(v_profile.cashback_minimum_amount, 0) AND v_base_amount > 0 THEN
                    
                    -- Calcular valor do cashback
                    IF v_profile.cashback_type = 'fixed' THEN
                        v_cashback_amount := COALESCE(v_profile.cashback_fixed_value, 0);
                    ELSE
                        -- Default: percentage
                        v_cashback_amount := (v_base_amount * COALESCE(v_profile.cashback_percentage, 0)) / 100;
                    END IF;

                    -- Se o cashback for maior que zero, conceder o crédito
                    IF v_cashback_amount > 0 THEN
                        
                        -- Calcular expiração
                        IF v_profile.cashback_expiration_days IS NOT NULL AND v_profile.cashback_expiration_days > 0 THEN
                            v_expires_at := now() + (v_profile.cashback_expiration_days || ' days')::interval;
                        END IF;

                        -- Inserir o crédito
                        INSERT INTO public.customer_credits (
                            tenant_id,
                            customer_id,
                            appointment_id,
                            amount,
                            used_amount,
                            status,
                            credit_type,
                            expires_at
                        ) VALUES (
                            NEW.tenant_id,
                            NEW.customer_id,
                            NEW.id,
                            v_cashback_amount,
                            0,
                            'available',
                            'cashback',
                            v_expires_at
                        );

                        -- Atualizar o agendamento com o valor ganho
                        UPDATE public.appointments 
                        SET cashback_earned = v_cashback_amount
                        WHERE id = NEW.id;

                        -- Atualizar o saldo do cliente
                        UPDATE public.customers
                        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
                            credits = COALESCE(credits, 0) + v_cashback_amount
                        WHERE id = NEW.customer_id;

                        -- Registrar na tabela de histórico de transações de cashback
                        INSERT INTO public.cashback_transactions (
                            tenant_id,
                            customer_id,
                            appointment_id,
                            type,
                            amount,
                            base_amount,
                            description
                        ) VALUES (
                            NEW.tenant_id,
                            NEW.customer_id,
                            NEW.id,
                            'earned',
                            v_cashback_amount,
                            v_base_amount,
                            'Cashback gerado pelo agendamento ' || NEW.id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
