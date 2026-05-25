CREATE POLICY "Public can create customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);