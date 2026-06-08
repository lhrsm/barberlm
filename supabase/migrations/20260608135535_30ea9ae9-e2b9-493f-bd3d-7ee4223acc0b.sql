-- 1. Modify automation_queue table
ALTER TABLE public.automation_queue 
ADD COLUMN IF NOT EXISTS automation_type TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ALTER COLUMN automation_id DROP NOT NULL;

-- 2. Create the trigger function for new appointments
CREATE OR REPLACE FUNCTION public.fn_on_appointment_created_enqueue_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Only for confirmed appointments with all necessary data
    IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND NEW.tenant_id IS NOT NULL AND NEW.management_token IS NOT NULL THEN
        
        -- Check for duplication
        SELECT EXISTS (
            SELECT 1 FROM public.automation_queue 
            WHERE appointment_id = NEW.id 
            AND (automation_type = 'new_appointment' OR workflow_key = 'appointment_confirmation')
        ) INTO v_exists;

        IF NOT v_exists THEN
            -- Insert into queue
            INSERT INTO public.automation_queue (
                tenant_id,
                appointment_id,
                customer_id,
                automation_type,
                workflow_key,
                status,
                scheduled_for,
                attempts,
                created_at,
                updated_at
            ) VALUES (
                NEW.tenant_id,
                NEW.id,
                NEW.customer_id,
                'new_appointment',
                'appointment_confirmation',
                'pending',
                now(),
                0,
                now(),
                now()
            );
            
            -- Optional: Trigger a log entry for auditing
            INSERT INTO public.automation_logs (
                tenant_id,
                appointment_id,
                status,
                message_type,
                payload
            ) VALUES (
                NEW.tenant_id,
                NEW.id,
                'pending',
                'new_appointment',
                jsonb_build_object(
                    'diagnostic', 'automation_queue_created',
                    'trigger', 'database_trigger'
                )
            );
        ELSE
            -- Log duplicate skipped
            INSERT INTO public.automation_logs (
                tenant_id,
                appointment_id,
                status,
                message_type,
                payload
            ) VALUES (
                NEW.tenant_id,
                NEW.id,
                'skipped',
                'new_appointment',
                jsonb_build_object(
                    'diagnostic', 'automation_queue_duplicate_skipped',
                    'trigger', 'database_trigger'
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment ON public.appointments;
CREATE TRIGGER tr_enqueue_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.fn_on_appointment_created_enqueue_automation();

-- Ensure also triggers on UPDATE if status changes to confirmed
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment_update ON public.appointments;
CREATE TRIGGER tr_enqueue_new_appointment_update
AFTER UPDATE ON public.appointments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed')
EXECUTE FUNCTION public.fn_on_appointment_created_enqueue_automation();

-- 4. Grant permissions
GRANT ALL ON public.automation_queue TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_queue TO authenticated;
