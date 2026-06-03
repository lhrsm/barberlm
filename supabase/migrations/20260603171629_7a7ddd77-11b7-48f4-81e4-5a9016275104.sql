-- 1. Fix automation_queue schema
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_queue' AND column_name = 'event_name') THEN
        ALTER TABLE public.automation_queue ADD COLUMN event_name TEXT;
    END IF;
END $$;

-- 2. Create automation_cron_runs table for monitoring
CREATE TABLE IF NOT EXISTS public.automation_cron_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    appointment_id UUID,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, error
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    found_count INTEGER DEFAULT 0,
    eligible_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error TEXT,
    errors JSONB DEFAULT '[]'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    processed_appointments JSONB DEFAULT '[]'::jsonb
);

-- 3. Grants
GRANT ALL ON public.automation_cron_runs TO authenticated;
GRANT ALL ON public.automation_cron_runs TO service_role;
GRANT ALL ON public.automation_queue TO authenticated;
GRANT ALL ON public.automation_queue TO service_role;

-- 4. RLS
ALTER TABLE public.automation_cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can view their own cron runs" ON public.automation_cron_runs FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Super admins can view all cron runs" ON public.automation_cron_runs FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_queue_updated_at') THEN
        CREATE TRIGGER update_automation_queue_updated_at BEFORE UPDATE ON public.automation_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;