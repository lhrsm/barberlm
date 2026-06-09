-- 1. Atualizar Função de Verificação de Status Financeiro
CREATE OR REPLACE FUNCTION public.check_appointment_financial_status(p_appointment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Agendamento não encontrado');
    END IF;

    -- Lógica de detecção de Pix
    v_pix_amount := COALESCE(v_appt.pix_amount, 0);
    -- Se o valor pix estiver zerado mas o método for pix e estiver pago, o valor real é o preço total menos créditos/cashback
    IF v_pix_amount = 0 AND v_appt.payment_method ~* 'pix' AND v_appt.payment_status = 'paid' THEN
        v_pix_amount := v_appt.total_price - COALESCE(v_appt.credits_used, v_appt.credit_used, 0) - COALESCE(v_appt.cashback_used, 0);
        IF v_pix_amount < 0 THEN v_pix_amount := 0; END IF;
    END IF;

    v_is_pix_paid := (v_appt.payment_status = 'paid') AND (v_pix_amount > 0);
    
    -- Lógica de detecção de Créditos e Cashback
    v_credits_used := COALESCE(v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE(v_appt.cashback_used, 0);

    RETURN jsonb_build_object(
        'has_paid_pix', v_is_pix_paid,
        'paid_pix_amount', v_pix_amount,
        'has_used_credits', (v_credits_used > 0),
        'used_credit_amount', v_credits_used,
        'has_used_cashback', (v_cashback_used > 0),
        'used_cashback_amount', v_cashback_used,
        'total_value', v_appt.total_price,
        'requires_financial_decision', (v_is_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar Função de Conclusão de Agendamento
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT,
    p_changed_by_id UUID,
    p_source TEXT,
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
    -- Audit Load
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Avoid double completion financial impact
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- Extract values
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'card_amount')::numeric, (p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Se for Pix Pago e o valor estiver zerado no metadata/appointment, inferir o valor real
    IF v_payment_method ~* 'pix' AND v_payment_status = 'paid' AND v_pix_amount = 0 THEN
        v_pix_amount := v_appt.total_price - v_credit_used - v_cashback_used;
        IF v_pix_amount < 0 THEN v_pix_amount := 0; END IF;
    END IF;

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    
    -- Montar descrição do lançamento
    v_description := 'Pagamento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');

    -- Update Appointment
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
            'pix_amount', v_pix_amount,
            'cash_amount', v_cash_amount,
            'card_amount', v_card_amount,
            'credits_used', v_credit_used,
            'cashback_used', v_cashback_used
        )
    WHERE id = p_appointment_id;

    -- Financial Transaction Registration (Income)
    -- Register income if there is real money or if it's explicitly confirmed
    IF (v_pix_amount + v_cash_amount + v_card_amount) > 0 OR v_payment_status = 'paid' THEN
        INSERT INTO public.transactions (
            user_id,
            tenant_id,
            appointment_id,
            barber_id,
            type,
            category,
            amount,
            pix_amount,
            cash_amount,
            credit_card_amount,
            credits_amount,
            cashback_amount,
            payment_method,
            description,
            date,
            payment_breakdown
        ) VALUES (
            v_appt.tenant_id,
            v_appt.tenant_id,
            p_appointment_id,
            v_appt.barber_id,
            'income',
            'Serviço',
            v_final_amount,
            v_pix_amount,
            v_cash_amount,
            v_card_amount,
            v_credit_used,
            v_cashback_used,
            v_payment_method,
            v_description,
            CURRENT_DATE,
            jsonb_build_object(
                'pix_amount', v_pix_amount,
                'cash_amount', v_cash_amount,
                'card_amount', v_card_amount,
                'credits_used', v_credit_used,
                'cashback_used', v_cashback_used
            )
        ) RETURNING id INTO v_trans_id;
    END IF;

    -- Log status change
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source, p_metadata
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_trans_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
