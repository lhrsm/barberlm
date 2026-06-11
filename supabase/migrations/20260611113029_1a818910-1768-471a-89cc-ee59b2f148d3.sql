
-- 1. Appointments: drop the broken management_token public policy
DROP POLICY IF EXISTS "Public access to appointments via management_token" ON public.appointments;

-- 2. Automation status: drop the misconfigured public ALL policy
DROP POLICY IF EXISTS "Service role can manage automation status" ON public.automation_status;
DROP POLICY IF EXISTS "Everyone can view automation status" ON public.automation_status;
CREATE POLICY "Service role manages automation status"
  ON public.automation_status FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 3. Client auth: drop overly permissive SELECT, restrict to service_role
DROP POLICY IF EXISTS "Clients can view their own auth record" ON public.client_auth;
CREATE POLICY "Service role reads client auth"
  ON public.client_auth FOR SELECT
  TO service_role USING (true);

-- 4. Refund requests: drop public SELECT
DROP POLICY IF EXISTS "Users can view their own refund requests" ON public.refund_requests;

-- 5. System health settings: enable RLS + lock down
ALTER TABLE public.system_health_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins manage system health settings" ON public.system_health_settings;
CREATE POLICY "Super admins manage system health settings"
  ON public.system_health_settings FOR ALL
  TO authenticated
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());
CREATE POLICY "Service role manages system health settings"
  ON public.system_health_settings FOR ALL
  TO service_role USING (true) WITH CHECK (true);
