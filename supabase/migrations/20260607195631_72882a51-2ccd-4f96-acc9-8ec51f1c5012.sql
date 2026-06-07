-- Drop existing function to recreate it with enhanced logic
CREATE OR REPLACE FUNCTION public.request_appointment_refund(
    p_appointment_id UUID,
    p_customer_id UUID,
    p_tenant_id UUID,
    p_amount NUMERIC,
    p_pix_key TEXT,
    p_pix_key_type TEXT,
    p_account_holder_name TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_existing_refund_id UUID;
    v_existing_credit_id UUID;
    v_refund_id UUID;
BEGIN
    -- 1. Check if refund already exists for this appointment (not rejected/cancelled)
    SELECT id INTO v_existing_refund_id 
    FROM public.refund_requests 
    WHERE appointment_id = p_appointment_id 
    AND status NOT IN ('rejected', 'cancelled');
    
    IF v_existing_refund_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno ativa para este agendamento.');
    END IF;

    -- 2. Check if credit already exists for this appointment
    SELECT id INTO v_existing_credit_id
    FROM public.customer_credits
    WHERE appointment_id = p_appointment_id
    AND status != 'cancelled';
    
    IF v_existing_credit_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'O valor deste agendamento já foi convertido em crédito.');
    END IF;

    -- 3. Update appointment status
    UPDATE public.appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        customer_action_source = 'link_publico',
        refund_status = 'requested',
        refund_type = 'refund'
    WHERE id = p_appointment_id;

    -- 4. Insert refund request
    INSERT INTO public.refund_requests (
        appointment_id,
        customer_id,
        tenant_id,
        amount,
        payment_method,
        status,
        notes,
        requested_at
    ) VALUES (
        p_appointment_id,
        p_customer_id,
        p_tenant_id,
        p_amount,
        'pix',
        'requested',
        'Titular: ' || p_account_holder_name || ' | Chave: ' || p_pix_key || ' (' || p_pix_key_type || ') | Obs: ' || COALESCE(p_notes, ''),
        now()
    ) RETURNING id INTO v_refund_id;

    RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
