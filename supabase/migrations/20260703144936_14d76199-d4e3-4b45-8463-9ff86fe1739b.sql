
-- ============================================================
-- APPOINTMENTS: INSERT policy pública robusta
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;

CREATE POLICY "Public can create appointments"
ON public.appointments
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = appointments.tenant_id)
);

-- ============================================================
-- APPOINTMENT_GROUPS: INSERT policy pública robusta
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create appointment groups" ON public.appointment_groups;
DROP POLICY IF EXISTS "Public can create appointment groups" ON public.appointment_groups;

CREATE POLICY "Public can create appointment groups"
ON public.appointment_groups
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = appointment_groups.tenant_id)
);
