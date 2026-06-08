CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid,
    p_cancelled_by text,
    p_source text,
    p_refund_preference text DEFAULT 'none',
    p_changed_by_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
    v_tenant_id UUID;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_already_reversed_credits BOOLEAN;
    v_already_reversed_cashback BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Fetch appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Prevent double cancellation
    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    v_tenant_id := v_appt.tenant_id;
    v_credits_used := COALESCE(v_appt.credits_used, 0);
    v_cashback_used := COALESCE(v_appt.cashback_used, 0);
    
    -- Calculate Pix amount accurately
    IF v_appt.pix_amount IS NOT NULL AND v_appt.pix_amount > 0 THEN
        v_pix_amount := v_appt.pix_amount;
    ELSE
        v_pix_amount := GREATEST(0, COALESCE(v_appt.total_price, 0) - v_credits_used - v_cashback_used);
    END IF;

    -- Check if it's a confirmed Pix payment
    v_is_pix_paid := (v_appt.payment_method IN ('pix', 'PIX', 'Pix') OR v_pix_amount > 0) 
                     AND v_appt.payment_status IN ('paid', 'confirmed', 'completed', 'aprovado', 'pago');

    -- 3. Update appointment status
    UPDATE public.appointments
    SET
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 4. Log status change
    INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        changed_by_id
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'cancelled',
        p_cancelled_by,
        p_source,
        p_changed_by_id
    );

    -- 5. Automatic reversal of Credits
    IF v_credits_used > 0 THEN
        -- Check for duplication
        SELECT EXISTS (
            SELECT 1 FROM public.credit_transactions 
            WHERE appointment_id = p_appointment_id 
            AND type = 'credit_reversed'
        ) INTO v_already_reversed_credits;

        IF NOT v_already_reversed_credits THEN
            -- Update customer balance
            UPDATE public.customers
            SET credits = COALESCE(credits, 0) + v_credits_used
            WHERE id = v_appt.customer_id;

            -- Log transaction
            INSERT INTO public.credit_transactions (
                tenant_id,
                customer_id,
                appointment_id,
                type,
                amount,
                description
            ) VALUES (
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                'credit_reversed',
                v_credits_used,
                'Crédito devolvido por cancelamento de agendamento'
            );
            
            -- Financial adjustment log (not a new revenue)
            INSERT INTO public.transactions (
                user_id,
                tenant_id,
                appointment_id,
                amount,
                type,
                description,
                category,
                barber_id,
                date
            ) VALUES (
                v_tenant_id,
                v_tenant_id,
                p_appointment_id,
                v_credits_used,
                'adjustment',
                'Estorno de Créditos (Cancelamento)',
                'Ajuste',
                v_appt.barber_id,
                CURRENT_DATE
            );
        END IF;
    END IF;

    -- 6. Automatic reversal of Cashback
    IF v_cashback_used > 0 THEN
        -- Check for duplication
        SELECT EXISTS (
            SELECT 1 FROM public.cashback_transactions 
            WHERE appointment_id = p_appointment_id 
            AND type = 'cashback_reversed'
        ) INTO v_already_reversed_cashback;

        IF NOT v_already_reversed_cashback THEN
            -- Update customer balance
            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_used
            WHERE id = v_appt.customer_id;

            -- Log transaction
            INSERT INTO public.cashback_transactions (
                tenant_id,
                customer_id,
                appointment_id,
                type,
                amount,
                description
            ) VALUES (
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                'cashback_reversed',
                v_cashback_used,
                'Cashback devolvido por cancelamento de agendamento'
            );
            
            -- Financial adjustment log
            INSERT INTO public.transactions (
                user_id,
                tenant_id,
                appointment_id,
                amount,
                type,
                description,
                category,
                barber_id,
                date
            ) VALUES (
                v_tenant_id,
                v_tenant_id,
                p_appointment_id,
                v_cashback_used,
                'adjustment',
                'Estorno de Cashback (Cancelamento)',
                'Ajuste',
                v_appt.barber_id,
                CURRENT_DATE
            );
        END IF;
    END IF;

    -- 7. Handle Pix Portion based on preference
    IF v_is_pix_paid AND v_pix_amount > 0 THEN
        IF p_refund_preference = 'credits' THEN
            -- Create customer credit for the Pix portion
            INSERT INTO public.customer_credits (
                tenant_id,
                customer_id,
                appointment_id,
                amount,
                status,
                credit_type,
                source_payment_id
            ) VALUES (
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                v_pix_amount,
                'available',
                'cancellation_credit',
                v_appt.payment_id
            ) RETURNING id INTO v_credit_id;

            -- Log financial transaction for credit (credit_granted)
            INSERT INTO public.transactions (
                user_id,
                tenant_id,
                appointment_id,
                amount,
                type,
                description,
                category,
                barber_id,
                date
            ) VALUES (
                v_tenant_id,
                v_tenant_id,
                p_appointment_id,
                v_pix_amount,
                'credit_granted',
                'Pix convertido em crédito por cancelamento',
                'Crédito',
                v_appt.barber_id,
                CURRENT_DATE
            );
        ELSIF p_refund_preference = 'refund' THEN
            -- Create refund request for the Pix portion
            INSERT INTO public.refund_requests (
                tenant_id,
                appointment_id,
                customer_id,
                amount,
                status,
                payment_method,
                payment_id,
                refund_method
            ) VALUES (
                v_tenant_id,
                p_appointment_id,
                v_appt.customer_id,
                v_pix_amount,
                'requested',
                'pix',
                v_appt.payment_id,
                'pix'
            ) RETURNING id INTO v_refund_id;

            -- Log financial transaction for refund (refund_requested)
            INSERT INTO public.transactions (
                user_id,
                tenant_id,
                appointment_id,
                amount,
                type,
                description,
                category,
                barber_id,
                date
            ) VALUES (
                v_tenant_id,
                v_tenant_id,
                p_appointment_id,
                v_pix_amount,
                'refund_requested',
                'Solicitação de estorno Pix (Cancelamento)',
                'Estorno',
                v_appt.barber_id,
                CURRENT_DATE
            );
        END IF;
    END IF;

    -- 8. Prepare result
    v_result := jsonb_build_object(
        'success', true,
        'pix_refund_amount', CASE WHEN v_is_pix_paid THEN v_pix_amount ELSE 0 END,
        'credits_reversed', v_credits_used,
        'cashback_reversed', v_cashback_used,
        'refund_id', v_refund_id,
        'credit_id', v_credit_id
    );

    RETURN v_result;
END;
$$;