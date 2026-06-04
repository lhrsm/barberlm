CREATE TABLE IF NOT EXISTS public.automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    automation_id UUID NOT NULL REFERENCES public.automation_templates(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_queue TO authenticated;
GRANT ALL ON public.automation_queue TO service_role;

-- RLS
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own automation_queue" 
ON public.automation_queue 
FOR ALL 
USING (auth.uid() = tenant_id)
WITH CHECK (auth.uid() = tenant_id);

-- Trigger Function
CREATE OR REPLACE FUNCTION public.tr_handle_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    tpl_record RECORD;
BEGIN
    -- Check if it's a new appointment
    -- Find active template for appointment confirmation for this tenant
    SELECT * INTO tpl_record 
    FROM public.automation_templates 
    WHERE tenant_id = NEW.tenant_id 
    AND key = 'appointment_confirmation' 
    AND active = true;

    IF FOUND THEN
        -- Insert into queue
        INSERT INTO public.automation_queue (tenant_id, automation_id, appointment_id, status)
        VALUES (NEW.tenant_id, tpl_record.id, NEW.id, 'pending');
        
        -- Optional: notify edge function via HTTP if net extension is available, 
        -- but usually a cron job or separate process is safer.
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS tr_appointment_confirmation ON public.appointments;
CREATE TRIGGER tr_appointment_confirmation
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.tr_handle_appointment_confirmation();
