-- Ensure public access to all necessary public tables
DROP POLICY IF EXISTS "Public access" ON public.profiles;
CREATE POLICY "Public access" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public access" ON public.services;
CREATE POLICY "Public access" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public access" ON public.barbers;
CREATE POLICY "Public access" ON public.barbers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public access" ON public.products;
CREATE POLICY "Public access" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public access" ON public.barber_services;
CREATE POLICY "Public access" ON public.barber_services FOR SELECT USING (true);

-- Appointments - ensure only public can see availability
DROP POLICY IF EXISTS "Public access for availability" ON public.appointments;
CREATE POLICY "Public access for availability" ON public.appointments FOR SELECT USING (status = 'scheduled');

-- Customers - ensure phone lookup works
DROP POLICY IF EXISTS "Allow public lookup by phone" ON public.customers;
CREATE POLICY "Allow public lookup by phone" ON public.customers FOR SELECT USING (true);
