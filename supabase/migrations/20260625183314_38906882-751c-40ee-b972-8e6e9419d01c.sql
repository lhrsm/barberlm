
DROP POLICY IF EXISTS "Barber panel can read its notifications" ON public.notifications;
CREATE POLICY "Barber panel can read its notifications"
  ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (barber_id IS NOT NULL);

DROP POLICY IF EXISTS "Barber panel can update its notifications" ON public.notifications;
CREATE POLICY "Barber panel can update its notifications"
  ON public.notifications
  FOR UPDATE
  TO anon, authenticated
  USING (barber_id IS NOT NULL)
  WITH CHECK (barber_id IS NOT NULL);

GRANT SELECT, UPDATE ON public.notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
