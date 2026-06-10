CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text, p_changed_by_id uuid, p_source text DEFAULT 'frontend'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
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
    v_cashback_earned NUMERIC(10,2) := 0;
    v_existing_cashback BOOLEAN;
BEGIN
    -- Buscar agendamento
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

    -- Buscar configurações do tenant (cashback)
    SELECT cashback_enabled, cashback_percentage, cashback_minimum_amount
    FROM public.profiles
    WHERE id = v_appt.tenant_id INTO v_tenant;

    -- Extração de valores do metadata ou do agendamento
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, (p_metadata->>'card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Normalização de valores se for 100% Pix/Dinheiro
    IF v_payment_method = 'pix' AND v_pix_amount = 0 AND v_credit_used = 0 AND v_cashback_used = 0 THEN
        v_pix_amount := v_appt.total_price;
    ELSIF v_payment_method = 'cash' AND v_cash_amount = 0 AND v_credit_used = 0 AND v_cashback_used = 0 THEN
        v_cash_amount := v_appt.total_price;
    END IF;

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    
    -- Registrar transação financeira de entrada
    v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');
    IF v_credit_used > 0 THEN v_description := v_description || ' (Créditos: R$ ' || v_credit_used || ')'; END IF;
    IF v_cashback_used > 0 THEN v_description := v_description || ' (Cashback: R$ ' || v_cashback_used || ')'; END IF;

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

    -- Lógica de Cashback Concedido
    IF v_tenant.cashback_enabled = true AND v_final_amount >= COALESCE(v_tenant.cashback_minimum_amount, 0) THEN
        -- Verificar se já existe cashback para este agendamento (prevenção duplicidade)
        SELECT EXISTS (
            SELECT 1 FROM public.cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type IN ('earned', 'cashback_earned')
        ) INTO v_existing_cashback;

        IF NOT v_existing_cashback THEN
            v_cashback_earned := ROUND((v_final_amount * COALESCE(v_tenant.cashback_percentage, 0) / 100)::numeric, 2);
            
            IF v_cashback_earned > 0 THEN
                -- Inserir transação de ganho de cashback
                INSERT INTO public.cashback_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, base_amount, description
                ) VALUES (
                    v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'earned', v_cashback_earned, v_final_amount, 'Cashback acumulado no agendamento'
                );

                -- Atualizar saldo do cliente
                UPDATE public.customers 
                SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned
                WHERE id = v_appt.customer_id;
            END IF;
        END IF;
    END IF;

    -- Débito de cashback se utilizado
    IF v_cashback_used > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'debit', v_cashback_used, 'Cashback utilizado no agendamento'
        );
        -- Atualizar saldo do cliente (débito)
        UPDATE public.customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_used
        WHERE id = v_appt.customer_id;
    END IF;

    -- Débito de crédito se utilizado
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'debit', v_credit_used, 'Crédito utilizado no agendamento'
        );
        -- Atualizar saldo do cliente (crédito)
        UPDATE public.customers 
        SET credits = COALESCE(credits, 0) - v_credit_used
        WHERE id = v_appt.customer_id;
    END IF;

    -- Atualizar Agendamento
    UPDATE public.appointments
    SET
        status = 'completed',
        payment_status = v_payment_status,
        completed_at = NOW(),
        credit_used = v_credit_used,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        cashback_earned = v_cashback_earned,
        final_amount = v_final_amount,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        payment_method = v_payment_method,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- Registrar log de status
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source, p_metadata
    );

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_earned,
        'final_amount', v_final_amount
    );
END;
$function$;
