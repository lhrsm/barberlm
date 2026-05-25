DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
DROP POLICY IF EXISTS "Public can create customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;

CREATE POLICY "Allow public insert on customers"
ON public.customers
FOR INSERT
TO public
WITH CHECK (true);