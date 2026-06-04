-- Add idempotency keys to prevent duplicates
ALTER TABLE public.automation_queue ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_idempotency ON public.automation_queue (idempotency_key) WHERE status != 'error';

ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_logs_idempotency ON public.automation_logs (idempotency_key);

-- Update Trigger to generate idempotency key
CREATE OR REPLACE FUNCTION public.tr_handle_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    tpl_record RECORD;
    v_idempotency_key TEXT;
BEGIN
    -- Only for new appointments
    IF (TG_OP = 'INSERT') THEN
        -- Find active template
        SELECT * INTO tpl_record 
        FROM public.automation_templates 
        WHERE tenant_id = NEW.tenant_id 
        AND key = 'appointment_confirmation' 
        AND active = true;

        IF FOUND THEN
            -- Generate key: type + appointment_id
            v_idempotency_key := 'appointment_confirmation:' || NEW.id;
            
            -- Insert into queue with idempotency check
            INSERT INTO public.automation_queue (tenant_id, automation_id, appointment_id, status, idempotency_key)
            VALUES (NEW.tenant_id, tpl_record.id, NEW.id, 'pending', v_idempotency_key)
            ON CONFLICT (idempotency_key) WHERE status != 'error' DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
