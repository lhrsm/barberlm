GRANT SELECT ON public.barbershop_modules TO anon;
CREATE POLICY "Public can read tenant modules"
ON public.barbershop_modules
FOR SELECT
TO anon
USING (true);