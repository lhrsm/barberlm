-- Add columns to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS webhook_received_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_received_configured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS webhook_received_last_response JSONB;

-- Add columns to zapi_integration_logs
ALTER TABLE public.zapi_integration_logs 
ADD COLUMN IF NOT EXISTS method TEXT,
ADD COLUMN IF NOT EXISTS request_body JSONB,
ADD COLUMN IF NOT EXISTS response_status INTEGER,
ADD COLUMN IF NOT EXISTS response_body JSONB,
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Update existing logs to map old columns to new columns where possible (optional but helpful)
-- UPDATE public.zapi_integration_logs SET method = 'PUT' WHERE action LIKE 'update-webhook%';
