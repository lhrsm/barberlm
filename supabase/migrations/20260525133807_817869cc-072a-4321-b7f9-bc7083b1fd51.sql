-- Remove client_token from whatsapp_connections if it exists
ALTER TABLE public.whatsapp_connections DROP COLUMN IF EXISTS client_token;

-- Ensure required columns exist
ALTER TABLE public.whatsapp_connections 
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS instance_token TEXT,
ADD COLUMN IF NOT EXISTS server_url TEXT DEFAULT 'https://api.z-api.io',
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS connected BOOLEAN DEFAULT false;

-- Clean up any potential junk in status
UPDATE public.whatsapp_connections SET status = 'disconnected' WHERE status NOT IN ('connected', 'disconnected');