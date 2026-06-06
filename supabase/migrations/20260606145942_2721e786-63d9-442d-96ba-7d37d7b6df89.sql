ALTER TABLE public.automation_templates 
ADD COLUMN IF NOT EXISTS reprocessing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reprocessing_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reprocessing_config JSONB DEFAULT '{"max_retries": 3, "backoff_factor": 2}'::jsonb;

GRANT ALL ON public.automation_templates TO service_role;
GRANT SELECT ON public.automation_templates TO authenticated;
