ALTER TABLE public.automation_cron_runs 
ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS error TEXT;

-- Ensure default values for existing columns
ALTER TABLE public.automation_cron_runs ALTER COLUMN processed_count SET DEFAULT 0;
ALTER TABLE public.automation_cron_runs ALTER COLUMN error_count SET DEFAULT 0;
