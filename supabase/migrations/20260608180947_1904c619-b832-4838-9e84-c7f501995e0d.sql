-- Update refund_requests to include Pix fields
ALTER TABLE public.refund_requests ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE public.refund_requests ADD COLUMN IF NOT EXISTS pix_type TEXT;
ALTER TABLE public.refund_requests ADD COLUMN IF NOT EXISTS holder_name TEXT;

-- Update cancel_appointment RPC to handle refund preferences and logs
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT DEFAULT 'admin',
    p_source TEXT DEFAULT 'direct',
    p_refund_preference TEXT DEFAULT 'none'
) RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
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
        source
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'cancelled',
        p_cancelled_by,
        p_source
    );

    -- 5. Handle Refund Preference (if paid)
    IF v_appt.payment_status = 'paid' THEN
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
                v_appt.tenant_id,
                v_appt.customer_id,
                v_appt.id,
                COALESCE(v_appt.amount_paid, v_appt.total_price),
                'available',
                'refund_credit',
                v_appt.payment_id
            ) ON CONFLICT (appointment_id) DO NOTHING
            RETURNING id INTO v_credit_id;
            
            -- Update payment status if exists
            -- Note: We don't have a payments table yet according to audit, 
            -- but we can update appointment info or wait for future implementation.
        ELSIF p_refund_preference = 'refund' THEN
            -- Create refund request
            INSERT INTO public.refund_requests (
                tenant_id,
                customer_id,
                appointment_id,
                amount,
                payment_method,
                status,
                payment_id
            ) VALUES (
                v_appt.tenant_id,
                v_appt.customer_id,
                v_appt.id,
                COALESCE(v_appt.amount_paid, v_appt.total_price),
                COALESCE(v_appt.payment_method, 'pix'),
                'requested',
                v_appt.payment_id
            ) ON CONFLICT (appointment_id) WHERE status <> ALL (ARRAY['rejected'::text, 'cancelled'::text]) DO NOTHING
            RETURNING id INTO v_refund_id;
        END IF;
    END IF;

    -- 6. Insert diagnostic logs for audit
    INSERT INTO public.automation_logs (
        tenant_id,
        appointment_id,
        status,
        message_type,
        payload
    ) VALUES (
        v_appt.tenant_id,
        v_appt.id,
        'success',
        'diagnostic',
        jsonb_build_object(
            'diagnostic', 'public_cancel_processed',
            'cancelled_by', p_cancelled_by,
            'refund_preference', p_refund_preference,
            'has_credit', v_credit_id IS NOT NULL,
            'has_refund_request', v_refund_id IS NOT NULL
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.customer_credits TO authenticated;
GRANT ALL ON public.customer_credits TO service_role;
