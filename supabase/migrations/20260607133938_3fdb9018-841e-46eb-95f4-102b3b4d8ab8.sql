ALTER TABLE public.automation_templates ADD COLUMN IF NOT EXISTS additional_templates JSONB DEFAULT '{}'::jsonb;
