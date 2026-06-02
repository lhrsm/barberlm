-- Ensure GRANTs for zapi_webhook_logs
GRANT SELECT, INSERT, UPDATE ON public.zapi_webhook_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zapi_webhook_logs TO anon;
GRANT ALL ON public.zapi_webhook_logs TO service_role;

-- Ensure RLS is enabled but permissive for debug/logging
ALTER TABLE public.zapi_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to see their own logs (based on barber_id)
-- Using OR true for now to facilitate global debugging as requested by the user,
-- but adding a more specific one if needed later.
DROP POLICY IF EXISTS "Enable all for everyone (webhook logs)" ON public.zapi_webhook_logs;
CREATE POLICY "Enable all for everyone (webhook logs)" 
ON public.zapi_webhook_logs
FOR ALL
USING (true);
