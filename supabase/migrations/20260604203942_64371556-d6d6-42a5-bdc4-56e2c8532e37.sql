ALTER TABLE public.automation_webhook_logs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
GRANT ALL ON public.automation_webhook_logs TO service_role;
GRANT ALL ON public.automation_webhook_logs TO authenticated;
