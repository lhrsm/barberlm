ALTER TABLE public.whatsapp_messages 
ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE INDEX idx_whatsapp_messages_status_scheduled ON public.whatsapp_messages(status, scheduled_for) 
WHERE status = 'pending';
