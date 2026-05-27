-- Update whatsapp_conversations table
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS appointment_group_id UUID,
ADD COLUMN IF NOT EXISTS last_action TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_group_id ON public.whatsapp_conversations(appointment_group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_active ON public.whatsapp_conversations(phone, active);
