ALTER TABLE public.whatsapp_conversations ADD COLUMN phone_fallback TEXT;
CREATE INDEX idx_whatsapp_conversations_phone_fallback ON public.whatsapp_conversations(phone_fallback);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
