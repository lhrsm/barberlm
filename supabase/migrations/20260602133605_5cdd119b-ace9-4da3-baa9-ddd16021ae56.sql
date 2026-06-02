-- Add ignored column to zapi_webhook_logs
ALTER TABLE public.zapi_webhook_logs ADD COLUMN IF NOT EXISTS ignored BOOLEAN DEFAULT false;

-- Add tracking columns to automation_logs
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS webhook_type TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS selected_option_raw TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS selected_option_normalized TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS state_before TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS state_after TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS message_sent TEXT;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS zapi_response JSONB;
ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS appointment_group_id UUID;

-- Ensure whatsapp_conversations is ready for the state machine
-- (Most columns already exist based on my check, but let's ensure indices)
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_active ON public.whatsapp_conversations (phone, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_barber_id ON public.whatsapp_conversations (barber_id);
