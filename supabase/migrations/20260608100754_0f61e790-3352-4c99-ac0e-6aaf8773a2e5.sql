-- First drop functions to avoid parameter default errors
DROP FUNCTION IF EXISTS public.complete_appointment(uuid,text,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid,text,text,text,uuid);

-- Update handle_payment_success to only touch payment_status
CREATE OR REPLACE FUNCTION public.handle_payment_success(p_appointment_id UUID, p_payment_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.appointments
    SET 
        payment_status = 'paid',
        payment_id = p_payment_id,
        updated_at = now()
    WHERE id = p_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_appointment to ensure payment is paid
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT,
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'system',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    UPDATE public.appointments
    SET 
        status = 'completed',
        payment_status = 'paid',
        completed_at = now(),
        completed_by = p_changed_by_id,
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure cancel_appointment handles statuses correctly
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT,
    p_source TEXT DEFAULT 'system',
    p_refund_preference TEXT DEFAULT 'none',
    p_changed_by_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
