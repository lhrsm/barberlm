CREATE OR REPLACE FUNCTION public.trigger_automation_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_name TEXT;
    v_tenant_id UUID;
    v_entity_type TEXT;
    v_entity_id UUID;
    v_payload JSONB;
BEGIN
    v_entity_id := NEW.id;
    
    -- Determine entity type and tenant_id
    IF TG_TABLE_NAME = 'appointments' THEN
        v_entity_type := 'appointment';
        v_tenant_id := NEW.tenant_id;
        
        IF TG_OP = 'INSERT' THEN
            -- DEDUPLICATION LOGIC FOR GROUPS
            -- If this appointment belongs to a group, only the "first" one inserted should trigger the event
            -- We check if an event for this group already exists in automation_events
            IF NEW.appointment_group_id IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM public.automation_events 
                    WHERE event_name = 'appointment.created'
                    AND (payload->'appointment'->>'appointment_group_id' = NEW.appointment_group_id::text
                         OR payload->>'appointment_group_id' = NEW.appointment_group_id::text)
                ) THEN
                    -- Already triggered for this group
                    RETURN NEW;
                END IF;
            END IF;

            v_event_name := 'appointment.created';
            v_payload := jsonb_build_object(
                'appointment', row_to_json(NEW),
                'appointment_group_id', NEW.appointment_group_id
            );
        ELSIF TG_OP = 'UPDATE' THEN
            -- Check for status changes
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
            -- Check for rescheduling
            ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
                v_event_name := 'appointment.rescheduled';
            ELSE
                -- Skip general updates if nothing important changed to avoid noise
                -- but if confirmation_sent was updated, we might want to log it?
                -- Actually, the user wants to avoid loops.
                IF NEW.confirmation_sent IS DISTINCT FROM OLD.confirmation_sent THEN
                    -- Skip events just for confirmation_sent flag updates to avoid loops
                    RETURN NEW;
                END IF;
                v_event_name := 'appointment.updated';
            END IF;
            v_payload := jsonb_build_object(
                'new', row_to_json(NEW),
                'old', row_to_json(OLD),
                'appointment_group_id', NEW.appointment_group_id
            );
        END IF;
        
    ELSIF TG_TABLE_NAME = 'customers' THEN
        v_entity_type := 'customer';
        v_tenant_id := NEW.tenant_id;
        
        IF TG_OP = 'INSERT' THEN
            v_event_name := 'customer.created';
            v_payload := jsonb_build_object('customer', row_to_json(NEW));
        ELSE
            v_event_name := 'customer.updated';
            v_payload := jsonb_build_object(
                'new', row_to_json(NEW),
                'old', row_to_json(OLD)
            );
        END IF;
    END IF;

    -- Insert into automation_events if an event name was determined
    IF v_event_name IS NOT NULL THEN
        INSERT INTO public.automation_events (tenant_id, event_name, entity_type, entity_id, payload)
        VALUES (v_tenant_id, v_event_name, v_entity_type, v_entity_id, v_payload);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also update queue_automation_event to handle potential race conditions or additional logic if needed
-- But deduplicating at the event level is stronger.
