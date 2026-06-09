-- Drop existing versions if they exist to ensure clean state
DROP FUNCTION IF EXISTS public.customer_cancel_simple(UUID, TEXT);
DROP FUNCTION IF EXISTS public.customer_cancel_return_credit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.customer_cancel_request_refund(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 1. Simple Cancellation (No financial strings)
CREATE OR REPLACE FUNCTION public.customer_cancel_simple(
    p_appointment_id UUID,
    p_source TEXT DEFAULT 'customer_portal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_fin RECORD;
BEGIN
    -- Get financial status
    SELECT * INTO v_fin FROM public.check_appointment_financial_status(p_appointment_id);
    
    IF v_fin.requires_financial_decision OR v_fin.has_paid_pix OR v_fin.has_used_credits OR v_fin.has_used_cashback THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento possui valores financeiros e requer decisão específica.');
    END IF;

    -- Update appointment
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancellation_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Cancel and Return Credits
CREATE OR REPLACE FUNCTION public.customer_cancel_return_credit(
    p_appointment_id UUID,
    p_source TEXT DEFAULT 'customer_portal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_fin RECORD;
    v_response JSONB;
BEGIN
    -- Get appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado.');
    END IF;

    -- Check if it actually has credits/cashback or Pix to be converted
    SELECT * INTO v_fin FROM public.check_appointment_financial_status(p_appointment_id);

    -- Call existing conversion RPC
    SELECT convert_appointment_to_credit(
        p_appointment_id,
        v_appt.customer_id,
        v_appt.tenant_id,
        v_appt.total_price
    ) INTO v_response;

    IF NOT (v_response->>'success')::BOOLEAN THEN
        RETURN v_response;
    END IF;

    -- Update status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancellation_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Cancel and Request Refund
CREATE OR REPLACE FUNCTION public.customer_cancel_request_refund(
    p_appointment_id UUID,
    p_holder_name TEXT,
    p_pix_key TEXT,
    p_pix_type TEXT,
    p_notes TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'customer_portal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_fin RECORD;
    v_response JSONB;
BEGIN
    -- Get appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado.');
    END IF;

    -- Check financial status
    SELECT * INTO v_fin FROM public.check_appointment_financial_status(p_appointment_id);
    
    IF NOT v_fin.has_paid_pix THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não possui pagamento Pix para estorno.');
    END IF;

    -- Call existing refund request RPC
    SELECT request_appointment_refund(
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

    -- Update status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        cancellation_source = p_source,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.customer_cancel_simple(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_cancel_return_credit(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_cancel_request_refund(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
