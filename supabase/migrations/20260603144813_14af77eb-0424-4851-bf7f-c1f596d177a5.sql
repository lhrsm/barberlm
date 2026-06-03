-- 1. Cleanup old triggers
DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
DROP FUNCTION IF EXISTS trigger_appointment_confirmation();

-- 2. Add columns for auditing and grouping
ALTER TABLE public.automation_events ADD COLUMN IF NOT EXISTS appointment_group_id UUID;
ALTER TABLE public.automation_queue ADD COLUMN IF NOT EXISTS appointment_group_id UUID;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS appointment_group_id UUID;

-- 3. Create Unique Index for Queue Deduplication
-- This ensures only one 'pending' or 'processing' item exists for the same group and workflow
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_queue_group_workflow 
ON public.automation_queue (tenant_id, workflow_id, appointment_group_id) 
WHERE appointment_group_id IS NOT NULL AND status IN ('pending', 'processing');

-- 4. Update trigger_automation_event to populate appointment_group_id column
CREATE OR REPLACE FUNCTION public.trigger_automation_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_name TEXT;
    v_tenant_id UUID;
    v_entity_type TEXT;
    v_entity_id UUID;
    v_payload JSONB;
    v_lock_id BIGINT;
BEGIN
    v_entity_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    
    IF TG_TABLE_NAME = 'appointments' THEN
        v_entity_type := 'appointment';
        
        IF TG_OP = 'INSERT' THEN
            -- DEDUPLICATION LOGIC FOR GROUPS
            IF NEW.appointment_group_id IS NOT NULL THEN
                v_lock_id := ('x' || substr(md5(NEW.appointment_group_id::text), 1, 16))::bit(64)::bigint;
                PERFORM pg_advisory_xact_lock(v_lock_id);

                IF EXISTS (
                    SELECT 1 FROM public.automation_events 
                    WHERE event_name = 'appointment.created'
                    AND tenant_id = v_tenant_id
                    AND appointment_group_id = NEW.appointment_group_id
                ) THEN
                    RETURN NEW; -- Already triggered
                END IF;
            END IF;

            v_event_name := 'appointment.created';
            v_payload := jsonb_build_object(
                'appointment', row_to_json(NEW),
                'appointment_group_id', NEW.appointment_group_id
            );
        ELSIF TG_OP = 'UPDATE' THEN
            -- Handle status changes
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                IF NEW.status = 'confirmed' THEN
                    v_event_name := 'appointment.confirmed';
                ELSIF NEW.status = 'cancelled' THEN
                    v_event_name := 'appointment.cancelled';
                ELSIF NEW.status = 'completed' THEN
                    v_event_name := 'appointment.completed';
                ELSE
                    v_event_name := 'appointment.updated';
                END IF;
            ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
                v_event_name := 'appointment.rescheduled';
            ELSE
                RETURN NEW; -- No relevant change
            END IF;
            
            v_payload := jsonb_build_object(
                'appointment', row_to_json(NEW),
                'old_appointment', row_to_json(OLD),
                'appointment_group_id', NEW.appointment_group_id
            );
        END IF;
    END IF;

    IF v_event_name IS NOT NULL THEN
        INSERT INTO public.automation_events (
            tenant_id, 
            event_name, 
            entity_type, 
            entity_id, 
            payload,
            appointment_group_id
        ) VALUES (
            v_tenant_id, 
            v_event_name, 
            v_entity_type, 
            v_entity_id, 
            v_payload,
            NEW.appointment_group_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update queue_automation_event to propagate appointment_group_id
CREATE OR REPLACE FUNCTION public.queue_automation_event()
RETURNS TRIGGER AS $$
BEGIN
    -- For each active workflow that matches this event, create a queue entry
    -- We use ON CONFLICT DO NOTHING because the unique index will handle deduplication
    INSERT INTO public.automation_queue (
        tenant_id, 
        event_id, 
        workflow_id, 
        status, 
        appointment_group_id
    )
    SELECT 
        NEW.tenant_id, 
        NEW.id, 
        id, 
        'pending', 
        NEW.appointment_group_id
    FROM public.automation_workflows
    WHERE trigger_event = NEW.event_name
      AND active = true
      AND (tenant_id = NEW.tenant_id OR tenant_id IS NULL)
    ON CONFLICT (tenant_id, workflow_id, appointment_group_id) 
    WHERE appointment_group_id IS NOT NULL AND status IN ('pending', 'processing')
    DO NOTHING;
      
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
