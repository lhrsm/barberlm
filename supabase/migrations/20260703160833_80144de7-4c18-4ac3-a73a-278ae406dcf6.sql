DROP POLICY IF EXISTS "Public access for availability" ON public.appointments;

CREATE POLICY "Public access for availability"
ON public.appointments FOR SELECT
TO anon, authenticated
USING (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'));