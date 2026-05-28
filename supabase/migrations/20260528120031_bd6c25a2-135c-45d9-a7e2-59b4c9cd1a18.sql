-- Add new columns to zapi_integration_logs for more detailed debugging
ALTER TABLE public.zapi_integration_logs 
ADD COLUMN IF NOT EXISTS endpoint TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS token_masked TEXT,
ADD COLUMN IF NOT EXISTS client_token_masked TEXT;

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapi_integration_logs TO authenticated;
GRANT ALL ON public.zapi_integration_logs TO service_role;
