
CREATE OR REPLACE FUNCTION public.customer_cancel_simple(p_appointment_id uuid, p_source text DEFAULT 'customer_portal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_fin JSONB;
BEGIN
    v_fin := public.check_appointment_financial_status(p_appointment_id);

    IF COALESCE((v_fin->>'requires_financial_decision')::boolean, false)
       OR COALESCE((v_fin->>'has_paid_pix')::boolean, false)
       OR COALESCE((v_fin->>'has_used_credits')::boolean, false)
       OR COALESCE((v_fin->>'has_used_cashback')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento possui valores financeiros e requer decisão específica.');
    END IF;

    UPDATE public.appointments
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancel_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_cancel_request_refund(p_appointment_id uuid, p_holder_name text, p_pix_key text, p_pix_type text, p_notes text DEFAULT NULL::text, p_source text DEFAULT 'customer_portal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_appt RECORD;
    v_fin JSONB;
    v_response JSONB;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado.');
    END IF;

    v_fin := public.check_appointment_financial_status(p_appointment_id);

    IF NOT COALESCE((v_fin->>'has_paid_pix')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não possui pagamento Pix para estorno.');
    END IF;

    SELECT public.request_appointment_refund(
        p_appointment_id,
        v_appt.customer_id,
        v_appt.tenant_id,
        COALESCE(v_appt.pix_amount, v_appt.total_price),
        p_pix_key,
        p_pix_type,
        p_holder_name,
        COALESCE(p_notes, 'Cancelamento solicitado pelo cliente via portal')
    ) INTO v_response;

    IF NOT (v_response->>'success')::BOOLEAN THEN
        RETURN v_response;
    END IF;

    UPDATE public.appointments
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancel_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;
