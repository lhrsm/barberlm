
-- Remove blanket "public ALL/SELECT/UPDATE = true" policies that expose sensitive data

-- automation_logs: drop blanket ALL public
DROP POLICY IF EXISTS "Enable all for everyone (automation logs)" ON public.automation_logs;
CREATE POLICY "Service role manages automation logs"
  ON public.automation_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- automation_webhook_logs: scope to service_role only
DROP POLICY IF EXISTS "Service role can do everything on webhook logs" ON public.automation_webhook_logs;
CREATE POLICY "Service role manages automation webhook logs"
  ON public.automation_webhook_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Tenants can view their automation webhook logs"
  ON public.automation_webhook_logs FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

-- zapi_webhook_logs: drop blanket public, scope to service_role
DROP POLICY IF EXISTS "Enable all for everyone (webhook logs)" ON public.zapi_webhook_logs;
DROP POLICY IF EXISTS "Service role can manage logs" ON public.zapi_webhook_logs;
CREATE POLICY "Service role manages zapi webhook logs"
  ON public.zapi_webhook_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- notifications: drop blanket USING(true) - scoped policies already cover legitimate access
DROP POLICY IF EXISTS "Barbeiros podem ver notificações" ON public.notifications;
DROP POLICY IF EXISTS "Barbeiros podem atualizar notificações" ON public.notifications;

-- client_auth: remove the dangerous public UPDATE-anyone policy (account takeover risk)
DROP POLICY IF EXISTS "Anyone can update client auth" ON public.client_auth;
-- Keep INSERT for new client registration via portal, but restrict UPDATE to service_role only
CREATE POLICY "Service role manages client auth updates"
  ON public.client_auth FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- profiles: drop duplicate blanket SELECT policy (the other "viewable by everyone" stays
-- because the public booking portal at /$slug needs anonymous lookup of barbershop pages)
DROP POLICY IF EXISTS "Public access" ON public.profiles;

-- Storage: fix barber-avatars update policy to require ownership of the path
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'barber-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'barber-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage: restrict support-attachments SELECT to ticket owner / super admin
DROP POLICY IF EXISTS "Authenticated can read support attachments" ON storage.objects;
CREATE POLICY "Ticket owners can read support attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.is_super_admin_user()
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE (storage.foldername(name))[1] = st.id::text
          AND (st.barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
               OR st.user_id = auth.uid())
      )
    )
  );

-- Lock down search_path on functions flagged by the linter
ALTER FUNCTION public.check_expired_trials() SET search_path = public;
ALTER FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.increment_coupon_usage(uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.notify_new_appointment() SET search_path = public;
ALTER FUNCTION public.handle_wallet_transaction() SET search_path = public;
ALTER FUNCTION public.tr_handle_appointment_confirmation() SET search_path = public;
ALTER FUNCTION public.handle_new_ticket_notification() SET search_path = public;
ALTER FUNCTION public.protect_role_column() SET search_path = public;
ALTER FUNCTION public.trigger_cashback_event() SET search_path = public;
ALTER FUNCTION public.handle_appointment_automation() SET search_path = public;
ALTER FUNCTION public.trigger_appointment_automation() SET search_path = public;
ALTER FUNCTION public.reconcile_automation_logs() SET search_path = public;
ALTER FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.cancel_appointment(uuid, text, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.update_appointment_status(uuid, text, text, uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.get_cron_status() SET search_path = public;
ALTER FUNCTION public.get_server_info() SET search_path = public;
ALTER FUNCTION public.ensure_appointment_tenant_id() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
