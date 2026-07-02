
ALTER TABLE public.customers ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
CREATE POLICY "Allow public insert on customers"
  ON public.customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (tenant_id IS NOT NULL);
