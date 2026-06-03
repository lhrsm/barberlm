-- Function to trigger automation events
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
            v_event_name := 'appointment.created';
            v_payload := jsonb_build_object('appointment', row_to_json(NEW));
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
                v_event_name := 'appointment.updated';
            END IF;
            v_payload := jsonb_build_object(
                'new', row_to_json(NEW),
                'old', row_to_json(OLD)
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

-- Triggers for appointments
DROP TRIGGER IF EXISTS tr_automation_appointment_event ON public.appointments;
CREATE TRIGGER tr_automation_appointment_event
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trigger_automation_event();

-- Triggers for customers
DROP TRIGGER IF EXISTS tr_automation_customer_event ON public.customers;
CREATE TRIGGER tr_automation_customer_event
AFTER INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.trigger_automation_event();

-- Function to automatically create a queue entry when an event is created
CREATE OR REPLACE FUNCTION public.queue_automation_event()
RETURNS TRIGGER AS $$
BEGIN
    -- For each active workflow that matches this event, create a queue entry
    INSERT INTO public.automation_queue (tenant_id, event_id, workflow_id, status)
    SELECT NEW.tenant_id, NEW.id, id, 'pending'
    FROM public.automation_workflows
    WHERE trigger_event = NEW.event_name
      AND active = true
      AND (tenant_id = NEW.tenant_id OR tenant_id IS NULL); -- Support global workflows if needed
      
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automation_events
DROP TRIGGER IF EXISTS tr_queue_automation_event ON public.automation_events;
CREATE TRIGGER tr_queue_automation_event
AFTER INSERT ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.queue_automation_event();
