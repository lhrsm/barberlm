-- Add columns to zapi_webhook_logs if they don't exist
ALTER TABLE public.zapi_webhook_logs 
ADD COLUMN IF NOT EXISTS selected_option TEXT,
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS status_code INTEGER;

-- Ensure RLS is enabled and policies exist (usually webhook tables are restricted to service_role)
ALTER TABLE public.zapi_webhook_logs ENABLE ROW LEVEL SECURITY;

-- If not already present, allow service_role to do everything
GRANT ALL ON public.zapi_webhook_logs TO service_role;
GRANT INSERT ON public.zapi_webhook_logs TO anon, authenticated; -- Z-API calls are usually unauthenticated

-- Create policy for service role if needed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zapi_webhook_logs' AND policyname = 'Service role can manage logs') THEN
        CREATE POLICY "Service role can manage logs" ON public.zapi_webhook_logs FOR ALL USING (true);
    END IF;
END $$;
