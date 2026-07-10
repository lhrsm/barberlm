ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]));