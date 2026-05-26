-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create automation_status table to track high-level status
CREATE TABLE IF NOT EXISTS public.automation_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_run_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'active', -- 'active', 'executing', 'error', 'offline'
    last_error TEXT,
    total_processed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    server_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    timezone TEXT DEFAULT 'America/Sao_Paulo'
);

-- Enable RLS
ALTER TABLE public.automation_status ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view automation status') THEN
        CREATE POLICY "Everyone can view automation status" ON public.automation_status FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage automation status') THEN
        CREATE POLICY "Service role can manage automation status" ON public.automation_status FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Ensure there is at least one row
INSERT INTO public.automation_status (status)
SELECT 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_status);

-- Fix Cron Jobs safely
DO $$
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN SELECT jobname FROM cron.job WHERE jobname IN ('run-automations', 'run-automations-every-5-minutes') LOOP
        PERFORM cron.unschedule(job_record.jobname);
    END LOOP;
END $$;

-- Create the new fixed job using pg_net
SELECT cron.schedule(
    'run-automations-every-5-minutes',
    '*/5 * * * *',
    $$
    SELECT
      net.http_post(
        url:='https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/run-automations',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg2ODAyOSwiZXhwIjoyMDkzNDQ0MDI5fQ.26R8TT2iA2F4IQGcGzZposIzLQOVB1Baw0TiyJDi5aA'
        ),
        body:=jsonb_build_object('scheduled', true)
      ) as request_id;
    $$
);
