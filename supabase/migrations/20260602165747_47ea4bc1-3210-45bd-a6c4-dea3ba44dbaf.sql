ALTER TABLE public.zapi_webhook_logs 
ADD COLUMN IF NOT EXISTS extracted_phone TEXT,
ADD COLUMN IF NOT EXISTS extracted_option TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

-- Use GRANT to set permissions for different roles.
GRANT SELECT, INSERT, UPDATE ON public.zapi_webhook_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zapi_webhook_logs TO service_role;
GRANT INSERT ON public.zapi_webhook_logs TO anon;
