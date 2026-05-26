ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS original_template TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS processed_template TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS response JSONB;
