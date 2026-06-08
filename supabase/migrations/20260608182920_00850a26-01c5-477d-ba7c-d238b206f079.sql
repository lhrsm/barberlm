-- 1. Drop existing versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid, text, text, text, uuid);

-- 2. Create the unified version
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid,
    p_cancelled_by text,
    p_source text,
    p_refund_preference text,
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
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                v_appt.total_price,
                'available',
                'refund',
                v_appt.payment_id -- Assumes this column exists or use NULL if not
            ) RETURNING id INTO v_credit_id;

            -- Log financial transaction for credit
            INSERT INTO public.credit_transactions (
                customer_id,
                amount,
                transaction_type,
                description,
                appointment_id
            ) VALUES (
                v_appt.customer_id,
                v_appt.total_price,
                'credit',
                'Crédito por cancelamento de agendamento',
                p_appointment_id
            );

        ELSIF p_refund_preference = 'refund' THEN
            -- Create refund request
            INSERT INTO public.refund_requests (
                tenant_id,
                appointment_id,
                customer_id,
                amount,
                status,
                reason
            ) VALUES (
                v_tenant_id,
                p_appointment_id,
                v_appt.customer_id,
                v_appt.total_price,
                'requested',
                'Cancelamento solicitado pelo cliente'
            ) RETURNING id INTO v_refund_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'refund_id', v_refund_id, 
        'credit_id', v_credit_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text, text, text, uuid) TO authenticated, anon;
