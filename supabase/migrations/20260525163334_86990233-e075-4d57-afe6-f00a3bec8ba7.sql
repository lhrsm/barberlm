-- Add barber_id to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES public.barbers(id);
CREATE INDEX IF NOT EXISTS idx_customers_barber_id ON public.customers(barber_id);

-- Add barber_id to product_sales
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES public.barbers(id);
CREATE INDEX IF NOT EXISTS idx_product_sales_barber_id ON public.product_sales(barber_id);

-- Update RLS policies for customers
DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
CREATE POLICY "Allow public insert on customers" 
ON public.customers 
FOR INSERT 
TO public
WITH CHECK (barber_id IS NOT NULL);

-- Update RLS policies for product_sales
DROP POLICY IF EXISTS "Public can create product sales" ON public.product_sales;
CREATE POLICY "Public can create product sales" 
ON public.product_sales 
FOR INSERT 
TO public
WITH CHECK (barber_id IS NOT NULL);

-- Ensure users (barbers/admins) can manage their own data
DROP POLICY IF EXISTS "Users can manage their own customers" ON public.customers;
CREATE POLICY "Users can manage their own customers" 
ON public.customers 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.barbers WHERE id = barber_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own product sales" ON public.product_sales;
CREATE POLICY "Users can manage their own product sales" 
ON public.product_sales 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.barbers WHERE id = barber_id AND user_id = auth.uid()));
