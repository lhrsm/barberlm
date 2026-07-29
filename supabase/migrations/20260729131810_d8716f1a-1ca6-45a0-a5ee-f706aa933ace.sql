-- 1. Avaliações: exige agendamento real, notas válidas e sem auto-aprovação
DROP POLICY IF EXISTS "Anyone can insert appointment reviews" ON public.appointment_reviews;
CREATE POLICY "Public can submit reviews for real appointments"
ON public.appointment_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  appointment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reviews.appointment_id
      AND a.tenant_id = appointment_reviews.tenant_id
  )
  AND (barbershop_rating IS NULL OR barbershop_rating BETWEEN 1 AND 5)
  AND (barber_rating IS NULL OR barber_rating BETWEEN 1 AND 5)
  AND (service_rating IS NULL OR service_rating BETWEEN 1 AND 5)
  AND coalesce(show_on_frontend, false) = false
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND reply IS NULL
);

-- 2. Notas de serviço: exige agendamento real e nota válida
DROP POLICY IF EXISTS "Customers can insert ratings" ON public.service_ratings;
CREATE POLICY "Public can rate real appointments"
ON public.service_ratings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  appointment_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = service_ratings.appointment_id)
  AND rating BETWEEN 1 AND 5
);

-- 3. Notificações administrativas: nada de inserção anônima
DROP POLICY IF EXISTS "Sistema/super admin pode inserir notificações" ON public.admin_notifications;
CREATE POLICY "Authenticated users can create admin notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Logs de módulos: apenas do próprio tenant
DROP POLICY IF EXISTS "Service writes module logs" ON public.barbershop_module_logs;
CREATE POLICY "Users write module logs for own tenant"
ON public.barbershop_module_logs
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_my_tenant_id()
  OR public.is_super_admin_user()
);