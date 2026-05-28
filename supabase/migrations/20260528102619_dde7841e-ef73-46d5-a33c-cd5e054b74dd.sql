ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_logs TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;