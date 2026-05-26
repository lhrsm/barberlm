-- Normalize automation_logs
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES auth.users(id);
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id);
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing data if tenant_id exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_logs' AND column_name = 'tenant_id') THEN
        UPDATE public.automation_logs SET barber_id = tenant_id WHERE barber_id IS NULL;
    END IF;
END $$;

-- Policies for automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Barbers can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Barbers can view their own automation logs"
ON public.automation_logs FOR SELECT
USING (auth.uid() = barber_id);

-- Update other tables policies
DROP POLICY IF EXISTS "Barbers can manage their own whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Barbers can manage their own whatsapp connections"
ON public.whatsapp_connections FOR ALL
USING (auth.uid() = barber_id);

DROP POLICY IF EXISTS "Barbers can manage their own automations" ON public.automations;
CREATE POLICY "Barbers can manage their own automations"
ON public.automations FOR ALL
USING (auth.uid() = barber_id);
