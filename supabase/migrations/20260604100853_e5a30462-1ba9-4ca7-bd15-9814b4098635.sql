ALTER TABLE public.automation_queue ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE public.automation_queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Grant permissions (standard procedure)
GRANT ALL ON public.automation_queue TO service_role;
GRANT SELECT, UPDATE ON public.automation_queue TO authenticated;
