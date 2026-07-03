
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (tenant_id IS NOT NULL);

DROP POLICY IF EXISTS "Public can create appointment groups" ON public.appointment_groups;
CREATE POLICY "Public can create appointment groups"
ON public.appointment_groups
FOR INSERT
TO anon, authenticated
WITH CHECK (tenant_id IS NOT NULL);
