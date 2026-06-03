-- 1. Update tr_queue_automation_event to set flow_type
CREATE OR REPLACE FUNCTION public.tr_queue_automation_event_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Determine flow type based on appointment_group_id
    -- If group_id is present, it's a multi flow
    -- Note: tr_automation_appointment_event handles deduplication so we only get one event per group
    
    INSERT INTO public.automation_queue (
        tenant_id, 
        event_id, 
        workflow_id, 
        status, 
        appointment_group_id,
        appointment_id,
        entity_id,
        entity_type,
        flow_type,
        payload
    )
    SELECT 
        NEW.tenant_id, 
        NEW.id, 
        w.id, 
        'pending', 
        NEW.appointment_group_id,
        NEW.entity_id,
        NEW.entity_id,
        NEW.entity_type,
        CASE WHEN NEW.appointment_group_id IS NOT NULL THEN 'multi'::public.automation_flow_type ELSE 'single'::public.automation_flow_type END,
        NEW.payload
    FROM public.automation_workflows w
    WHERE w.trigger_event = NEW.event_name
      AND w.active = true
      AND (w.tenant_id = NEW.tenant_id OR w.tenant_id IS NULL)
    ON CONFLICT (tenant_id, workflow_id, appointment_group_id) 
    WHERE appointment_group_id IS NOT NULL AND status IN ('pending', 'processing')
    DO NOTHING;
      
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-link trigger
DROP TRIGGER IF EXISTS tr_queue_automation_event ON public.automation_events;
CREATE TRIGGER tr_queue_automation_event
AFTER INSERT ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.tr_queue_automation_event_func();
