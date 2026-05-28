-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Tenants can view their own automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Barbers can view their own automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.automation_logs;
DROP POLICY IF EXISTS "Tenants can view their own debug logs" ON public.zapi_webhook_debug;

-- Re-create automation_logs policies
-- This policy allows users to see logs that match their profile's tenant_id
CREATE POLICY "Tenants can view their own automation logs"
ON public.automation_logs
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Re-create zapi_webhook_debug policies
-- This policy allows users to see debug logs that match their profile's tenant_id
CREATE POLICY "Tenants can view their own debug logs"
ON public.zapi_webhook_debug
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Ensure RLS is enabled
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_webhook_debug ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT ON public.automation_logs TO authenticated;
GRANT SELECT ON public.zapi_webhook_debug TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;
GRANT ALL ON public.zapi_webhook_debug TO service_role;

-- Grant INSERT to anon for the webhook to work (service role handles this in edge function, but safe to have if needed)
-- Actually, the edge function uses service role, so anon grants aren't strictly necessary for the table itself
-- but it doesn't hurt to ensure service_role has ALL.
