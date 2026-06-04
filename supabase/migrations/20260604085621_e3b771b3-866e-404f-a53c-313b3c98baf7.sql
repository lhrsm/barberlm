-- 1. Fix flow detection in trigger
CREATE OR REPLACE FUNCTION public.tr_queue_automation_event_func()
RETURNS TRIGGER AS $$
DECLARE
    v_appt_count INTEGER := 0;
    v_flow_type public.automation_flow_type;
BEGIN
    -- Check if we have a group_id
    IF NEW.appointment_group_id IS NOT NULL THEN
        SELECT count(*) INTO v_appt_count 
        FROM public.appointments 
        WHERE appointment_group_id = NEW.appointment_group_id;
        
        IF v_appt_count > 1 THEN
            v_flow_type := 'multi'::public.automation_flow_type;
        ELSE
            v_flow_type := 'single'::public.automation_flow_type;
        END IF;
    ELSE
        v_flow_type := 'single'::public.automation_flow_type;
    END IF;

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
        v_flow_type,
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

-- 2. Add diagnostic columns to automation_logs
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS appointments_found INTEGER;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS flow_type_selected TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS reason_selected TEXT;

GRANT ALL ON public.automation_logs TO authenticated, service_role;