-- Update update_appointment_status to prevent direct cancellation by CUSTOMERS when financial value exists
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID,
    p_new_status TEXT,
    p_changed_by_type TEXT,
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_old_status TEXT;
    v_appointment RECORD;
    v_is_pix_paid BOOLEAN;
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
BEGIN
    -- Audit Load
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_old_status := v_appointment.status;

    -- SAFETY CHECK: If status is being changed to 'cancelled' by a CUSTOMER
    IF p_new_status = 'cancelled' AND (p_changed_by_type = 'customer' OR p_source ILIKE '%portal%' OR p_source ILIKE '%public%') THEN
        v_credits_used := COALESCE(v_appointment.credits_used, 0);
        v_cashback_used := COALESCE(v_appointment.cashback_used, 0);
        v_is_pix_paid := (v_appointment.payment_status = 'paid') AND (COALESCE(v_appointment.pix_amount, 0) > 0 OR v_appointment.payment_method ~* 'pix');

        -- Block direct cancellation if financial value exists
        IF v_is_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Este agendamento possui valor financeiro e não pode ser cancelado diretamente. Use o fluxo de estorno/crédito.',
                'requires_financial_decision', true
            );
        END IF;
    END IF;

    -- Dynamic Update
    EXECUTE format('
        UPDATE appointments
        SET
            status = $1,
            updated_at = now(),
            confirmed_at = CASE WHEN $1 = ''confirmed'' THEN now() ELSE confirmed_at END,
            confirmed_by = CASE WHEN $1 = ''confirmed'' THEN $2 ELSE confirmed_by END,
            completed_at = CASE WHEN $1 = ''completed'' THEN now() ELSE completed_at END,
            completed_by = CASE WHEN $1 = ''completed'' THEN $2 ELSE completed_by END,
            cancelled_at = CASE WHEN $1 = ''cancelled'' THEN now() ELSE cancelled_at END,
            cancelled_by = CASE WHEN $1 = ''cancelled'' THEN $2 ELSE cancelled_by END,
            cancel_source = CASE WHEN $1 = ''cancelled'' THEN $3 ELSE cancel_source END
        WHERE id = $4', p_new_status, p_changed_by_type, p_source, p_appointment_id)
    USING p_new_status, p_changed_by_type, p_source, p_appointment_id;

    -- Logging
    INSERT INTO appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        changed_by_id,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_old_status,
        p_new_status,
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;