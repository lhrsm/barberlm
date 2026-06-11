CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text, p_changed_by_id uuid, p_source text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    v_total_price NUMERIC(10,2);
    v_cashback_base_amount NUMERIC(10,2);
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_description TEXT;
    v_cashback_earned NUMERIC(10,2) := 0;
    v_existing_cashback BOOLEAN;
    v_existing_trans BOOLEAN;
BEGIN
    -- 1. Buscar agendamento e validar
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

    -- 2. Buscar configurações do tenant
    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    -- 3. Extração de valores (Prioridade: Metadata > Agendamento)
    v_total_price := COALESCE(v_appt.total_price, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric, 
        (p_metadata->>'debit_card_amount')::numeric, 
        (p_metadata->>'card_amount')::numeric, 
        v_appt.credit_card_amount, 
        v_appt.debit_card_amount, 0
    );
    
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Lógica de Normalização de Valores
    -- Se for pagamento misto, confiamos na soma dos campos
    IF (v_payment_method = 'mixed' OR v_payment_method = 'misto') THEN
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    ELSE
        -- Se não for misto, e os campos estão zerados, calculamos o saldo
        IF (v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0) THEN
            v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used);
            IF (v_payment_method = 'pix') THEN v_pix_amount := v_final_amount;
            ELSIF (v_payment_method = 'cash') THEN v_cash_amount := v_final_amount;
            END IF;
        ELSE
            -- Se algum campo foi preenchido, respeitamos o preenchido
            v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
        END IF;
    END IF;

    -- CORREÇÃO: Cashback deve ser gerado sobre o valor TOTAL do serviço, 
    -- independente se pagou com crédito/cashback ou não.
    v_cashback_base_amount := v_total_price;
    
    -- 4. Registrar transação financeira (Entrada Real em Caixa)
    -- Verificamos se já existe uma transação vinculada a este agendamento
    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id) INTO v_existing_trans;

    IF NOT v_existing_trans THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');
        
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
        );
    END IF;

    -- 5. Cashback (Geração)
    SELECT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'credit') INTO v_existing_cashback;

    IF v_tenant.cashback_enabled AND v_cashback_base_amount >= COALESCE(v_tenant.cashback_minimum_amount, 0) AND NOT v_existing_cashback THEN
        v_cashback_earned := (v_cashback_base_amount * COALESCE(v_tenant.cashback_percentage, 0)) / 100;
        
        IF v_cashback_earned > 0 THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_earned, 'credit', 
                'Cashback gerado no atendimento ' || COALESCE(v_appt.service_name, '')
            ) ON CONFLICT (appointment_id) DO NOTHING;

            -- Atualizar saldo do cliente IMEDIATAMENTE no RPC para consistência
            UPDATE public.customers 
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    END IF;

    -- 6. Debitar Créditos/Cashback usados (Movimentações de saldo)
    IF v_credit_used > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM public.credit_transactions WHERE appointment_id = p_appointment_id AND type = 'debit') THEN
            INSERT INTO public.credit_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_credit_used, 'debit', 'Uso de créditos no atendimento');
        END IF;
    END IF;

    IF v_cashback_used > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'debit') THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_used, 'debit', 'Uso de cashback no atendimento');
        END IF;
    END IF;

    -- 7. Atualizar agendamento
    UPDATE public.appointments 
    SET 
        status = 'completed',
        payment_status = v_payment_status,
        payment_method = v_payment_method,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        cashback_earned = v_cashback_earned,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 8. Log de status
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source
    );

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_earned,
        'final_amount', v_final_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$