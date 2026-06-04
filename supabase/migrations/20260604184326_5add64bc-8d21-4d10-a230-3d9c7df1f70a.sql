ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_automation_logs_provider_message_id ON public.automation_logs(provider_message_id);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_response_sent_at TIMESTAMP WITH TIME ZONE;

-- Grant permissions just in case
GRANT ALL ON public.automation_logs TO service_role;
GRANT ALL ON public.appointments TO service_role;
