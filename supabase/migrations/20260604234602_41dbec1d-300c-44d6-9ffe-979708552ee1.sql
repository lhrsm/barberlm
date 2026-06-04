-- 1. Update automation_send_history
ALTER TABLE public.automation_send_history ADD COLUMN IF NOT EXISTS conversation_created BOOLEAN DEFAULT false;
ALTER TABLE public.automation_send_history ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.automation_conversations(id);
ALTER TABLE public.automation_send_history ADD COLUMN IF NOT EXISTS conversation_error TEXT;

-- 2. Update automation_webhook_logs with diagnostic columns
ALTER TABLE public.automation_webhook_logs ADD COLUMN IF NOT EXISTS query_filters_used JSONB;
ALTER TABLE public.automation_webhook_logs ADD COLUMN IF NOT EXISTS conversations_found_count INTEGER DEFAULT 0;
ALTER TABLE public.automation_webhook_logs ADD COLUMN IF NOT EXISTS conversation_selected_id UUID;
ALTER TABLE public.automation_webhook_logs ADD COLUMN IF NOT EXISTS appointment_id_found UUID;

-- 3. Grants
GRANT ALL ON public.automation_send_history TO service_role;
GRANT ALL ON public.automation_send_history TO authenticated;
GRANT ALL ON public.automation_webhook_logs TO service_role;
GRANT ALL ON public.automation_webhook_logs TO authenticated;