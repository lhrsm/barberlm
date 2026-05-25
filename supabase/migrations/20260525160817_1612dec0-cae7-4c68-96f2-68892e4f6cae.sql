-- Create policy for public product sales creation
CREATE POLICY "Public can create product sales"
ON public.product_sales
FOR INSERT
TO anon
WITH CHECK (true);

-- Ensure RLS is enabled (it already is, but good to be explicit)
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
