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
    
    -- Determine entity type and tenant_id
    IF TG_TABLE_NAME = 'appointments' THEN
        v_entity_type := 'appointment';
        v_tenant_id := NEW.tenant_id;
        
        IF TG_OP = 'INSERT' THEN
            -- DEDUPLICATION LOGIC FOR GROUPS
            IF NEW.appointment_group_id IS NOT NULL THEN
                -- Create a stable lock ID based on the group UUID string
                v_lock_id := ('x' || substr(md5(NEW.appointment_group_id::text), 1, 16))::bit(64)::bigint;
                
                -- Acquire an advisory lock for this group during this transaction
                PERFORM pg_advisory_xact_lock(v_lock_id);

                -- Now check if we already have an event for this group
                -- This check is now safe from race conditions within the same or parallel transactions
                IF EXISTS (
                    SELECT 1 FROM public.automation_events 
                    WHERE event_name = 'appointment.created'
                    AND tenant_id = v_tenant_id
                    AND (payload->>'appointment_group_id' = NEW.appointment_group_id::text)
                ) THEN
                    -- Already triggered for this group, exit
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
                -- Skip noise
                IF NEW.confirmation_sent IS DISTINCT FROM OLD.confirmation_sent THEN
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