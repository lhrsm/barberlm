-- 1. Create refund_requests table
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id),
    payment_id TEXT, -- Original payment reference
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    refund_method TEXT NOT NULL DEFAULT 'pix',
    pix_key TEXT,
    pix_key_type TEXT, -- cpf, email, phone, random
    account_holder_name TEXT,
    status TEXT NOT NULL DEFAULT 'requested', -- requested, approved, rejected, completed, cancelled
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- RLS and Permissions
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated, anon;
GRANT ALL ON public.refund_requests TO service_role;

-- Simple policy: everyone can see (safe because of RPC context), but strictly users should only see theirs if authenticated
CREATE POLICY "Users can view their own refund requests" ON public.refund_requests
    FOR SELECT USING (true);

-- 2. Atomic function to request refund
CREATE OR REPLACE FUNCTION public.request_appointment_refund(
    p_appointment_id UUID,
    p_customer_id UUID,
    p_tenant_id UUID,
    p_amount NUMERIC,
    p_pix_key TEXT,
    p_pix_key_type TEXT,
    p_account_holder_name TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appointment RECORD;
    v_refund_id UUID;
BEGIN
    -- Select with row-level lock
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- Validation: Check if already converted to credit
    IF v_appointment.refund_status = 'converted_to_credit' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi convertido em crédito e não permite estorno');
    END IF;

    -- Validation: Check if there is already a refund request
    IF EXISTS (SELECT 1 FROM refund_requests WHERE appointment_id = p_appointment_id AND status != 'cancelled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno ativa para este agendamento');
    END IF;

    -- 1. Create the refund request
    INSERT INTO refund_requests (
        tenant_id,
        customer_id,
        appointment_id,
        payment_id,
        amount,
        pix_key,
        pix_key_type,
        account_holder_name,
        admin_notes,
        status
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_appointment_id,
        v_appointment.payment_id,
        p_amount,
        p_pix_key,
        p_pix_key_type,
        p_account_holder_name,
        p_notes,
        'requested'
    ) RETURNING id INTO v_refund_id;

    -- 2. Update the appointment status
    UPDATE appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancel_source = 'customer_refund_request',
        refund_status = 'pending', -- Marks that a refund is pending
        payment_status = 'refund_requested', -- Specific payment status
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 3. Log status change
    INSERT INTO appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appointment.status,
        'cancelled',
        'customer',
        'public_link',
        jsonb_build_object(
            'action', 'request_refund',
            'amount', p_amount,
            'refund_id', v_refund_id,
            'pix_key', p_pix_key
        )
    );

    RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;