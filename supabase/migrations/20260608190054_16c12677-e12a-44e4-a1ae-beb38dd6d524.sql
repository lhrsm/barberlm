CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid,
    p_cancelled_by text,
    p_source text,
    p_refund_preference text DEFAULT 'none',
    p_changed_by_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
    v_tenant_id UUID;
    v_is_pix_paid BOOLEAN;
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
    
    -- Check if it's a confirmed Pix payment
    -- method/payment_method = pix AND status = paid, confirmed ou completed
    v_is_pix_paid := (v_appt.payment_method = 'pix' AND v_appt.payment_status IN ('paid', 'confirmed', 'completed'));

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

    -- 5. Handle Refund Preference (Strict logic for Pix or confirmed payments)
    IF v_is_pix_paid OR v_appt.payment_status IN ('paid', 'confirmed', 'completed') THEN
        IF p_refund_preference = 'credits' THEN
            -- Create customer credit
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
                COALESCE(v_appt.total_price, 0),
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
                COALESCE(v_appt.total_price, 0),
                'credit_granted',
                'Crédito concedido por cancelamento de agendamento: ' || p_appointment_id,
                'Crédito',
                v_appt.barber_id,
                CURRENT_DATE
            );

        ELSIF p_refund_preference = 'refund' THEN
            -- Create refund request
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
                COALESCE(v_appt.total_price, 0),
                'requested',
                COALESCE(v_appt.payment_method, 'pix'),
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
                COALESCE(v_appt.total_price, 0),
                'refund_requested',
                'Solicitação de estorno por cancelamento de agendamento: ' || p_appointment_id,
                'Estorno',
                v_appt.barber_id,
                CURRENT_DATE
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'credit_id', v_credit_id,
        'refund_id', v_refund_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
