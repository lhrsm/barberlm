ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS api_url TEXT,
ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'qrcode';

-- Update existing instances to qrcode type
UPDATE public.whatsapp_instances SET connection_type = 'qrcode' WHERE connection_type IS NULL;