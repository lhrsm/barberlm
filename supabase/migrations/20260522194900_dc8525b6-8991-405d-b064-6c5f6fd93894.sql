-- 1. BARBERS
DROP POLICY IF EXISTS "Barbers are viewable by everyone" ON public.barbers;
DROP POLICY IF EXISTS "Public access" ON public.barbers;
DROP POLICY IF EXISTS "Users can view their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Public select for barbers" ON public.barbers;

CREATE POLICY "Users can view their own barbers" 
ON public.barbers FOR SELECT 
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')));

CREATE POLICY "Public select for barbers" 
ON public.barbers FOR SELECT 
USING (true); -- Mantido para o portal público, o isolamento no admin será feito via código.

-- 2. SERVICES
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Public access" ON public.services;
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
DROP POLICY IF EXISTS "Public select for services" ON public.services;

CREATE POLICY "Users can view their own services" 
ON public.services FOR SELECT 
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')));

CREATE POLICY "Public select for services" 
ON public.services FOR SELECT 
USING (true);

-- 3. CUSTOMERS
DROP POLICY IF EXISTS "Allow anonymous SELECT on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public lookup by phone" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Public lookup for customers by phone" ON public.customers;

CREATE POLICY "Users can view their own customers" 
ON public.customers FOR SELECT 
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')));

-- 4. PRODUCTS
DROP POLICY IF EXISTS "Public access" ON public.products;
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Public select for products" ON public.products;

CREATE POLICY "Users can view their own products" 
ON public.products FOR SELECT 
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')));

CREATE POLICY "Public select for products" 
ON public.products FOR SELECT 
USING (true);

-- 5. APPOINTMENTS
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" 
ON public.appointments FOR SELECT 
USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')));
