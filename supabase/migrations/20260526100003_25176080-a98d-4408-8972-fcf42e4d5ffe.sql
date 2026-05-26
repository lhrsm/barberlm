
-- 1. Remove dangerous anon policies on appointments, notifications, transactions
DROP POLICY IF EXISTS "Allow anonymous SELECT on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow anonymous UPDATE on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow anonymous SELECT on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow anonymous UPDATE on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow anonymous SELECT on transactions" ON public.transactions;

-- 2. Lock down system-assets bucket: only super_admin can write
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;

CREATE POLICY "Super admin can upload system assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'system-assets' AND public.is_super_admin_user());

CREATE POLICY "Super admin can update system assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'system-assets' AND public.is_super_admin_user());

CREATE POLICY "Super admin can delete system assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'system-assets' AND public.is_super_admin_user());

-- 3. Restrict support-attachments: only authenticated users can upload/read
DROP POLICY IF EXISTS "Public Access to Support Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload support attachments" ON storage.objects;

CREATE POLICY "Authenticated can read support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');

CREATE POLICY "Authenticated can upload support attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

-- 4. Fix mutable search_path on SECURITY DEFINER / trigger functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.decrement_product_stock(uuid, integer) SET search_path = public;
ALTER FUNCTION public.handle_wallet_transaction() SET search_path = public;
ALTER FUNCTION public.generate_unique_slug(text) SET search_path = public;
ALTER FUNCTION public.sync_notification_read_status() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.notify_new_appointment() SET search_path = public;
ALTER FUNCTION public.update_barber_rating() SET search_path = public;
ALTER FUNCTION public.handle_appointment_completion() SET search_path = public;
ALTER FUNCTION public.handle_new_ticket_notification() SET search_path = public;
ALTER FUNCTION public.cancel_appointment_by_token(uuid) SET search_path = public;
ALTER FUNCTION public.cancel_appointment_by_token(text) SET search_path = public;
