CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_cancelled_by text, p_source text DEFAULT 'admin'::text, p_refund_preference text DEFAULT 'none'::text, p_changed_by_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
    v_tenant_id UUID;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
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

    -- Calculate Pix amount
    IF v_appt.pix_amount IS NOT NULL AND v_appt.pix_amount > 0 THEN
        v_pix_amount := v_appt.pix_amount;
    ELSE
        v_pix_amount := GREATEST(0, COALESCE(v_appt.total_price, 0) - v_credits_used - v_cashback_used);
    END IF;

    -- Check if it was paid via Pix
    v_is_pix_paid := (v_appt.payment_status = 'paid' OR v_appt.payment_status = 'confirmed' OR v_appt.payment_status = 'completed')
                     AND (v_appt.payment_method ~* 'pix' OR v_pix_amount > 0);

    -- 3. Avoid duplicates for refund/credit
    IF v_is_pix_paid THEN
        IF EXISTS (SELECT 1 FROM public.refund_requests WHERE appointment_id = p_appointment_id AND status != 'rejected') THEN
             RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno para este agendamento');
        END IF;
        IF EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = p_appointment_id) THEN
             RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi convertido em crédito');
        END IF;
    END IF;

    -- 4. Update appointment status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = now(),
        refund_status = CASE 
            WHEN NOT v_is_pix_paid THEN 'none'
            WHEN p_refund_preference = 'credits' THEN 'converted_to_credit'
            WHEN p_refund_preference = 'refund' THEN 'refund_requested'
            ELSE 'pending'
        END,
        refund_type = CASE
            WHEN p_refund_preference = 'credits' THEN 'credits'
            WHEN p_refund_preference = 'refund' THEN 'refund'
            ELSE NULL
        END
    WHERE id = p_appointment_id;

    -- 5. Log status change
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

    -- 6. Create refund request record if needed
    IF v_is_pix_paid AND p_refund_preference = 'refund' THEN
        INSERT INTO public.refund_requests (
            tenant_id,
            appointment_id,
            customer_id,
            amount,
            payment_method,
            status,
            requested_at,
            created_at
        ) VALUES (
            v_tenant_id,
            p_appointment_id,
            v_appt.customer_id,
            v_pix_amount,
            'pix',
            'requested',
            now(),
            now()
        ) RETURNING id INTO v_refund_id;
    END IF;

    -- 7. Create credit if needed
    IF v_is_pix_paid AND p_refund_preference = 'credits' THEN
        INSERT INTO public.customer_credits (
            tenant_id,
            customer_id,
            appointment_id,
            amount,
            credit_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_tenant_id,
            v_appt.customer_id,
            p_appointment_id,
            v_pix_amount,
            'refund_credit',
            'available',
            now(),
            now()
        ) RETURNING id INTO v_credit_id;
        
        -- Register history (assuming transactions table exists and is used for this)
        INSERT INTO public.transactions (
            user_id,
            tenant_id,
            amount,
            type,
            description,
            category,
            appointment_id,
            date,
            payment_method
        ) VALUES (
            v_tenant_id,
            v_tenant_id,
            v_pix_amount,
            'credit_granted',
            'Crédito por cancelamento de agendamento: ' || p_appointment_id,
            'Crédito',
            p_appointment_id,
            CURRENT_DATE,
            'credits'
        );
    END IF;

    -- 8. Return result
    RETURN jsonb_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'is_pix_paid', v_is_pix_paid,
        'pix_amount', v_pix_amount,
        'refund_id', v_refund_id,
        'credit_id', v_credit_id
    );
END;
$function$

