-- Drop overly permissive or problematic policies if they exist
DROP POLICY IF EXISTS "Users can manage their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Public access" ON public.barber_services;

-- Create robust policies for barber_services
-- Allow authenticated users to insert their own barber_services
CREATE POLICY "Users can insert their own barber_services" 
ON public.barber_services 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own barber_services
CREATE POLICY "Users can update their own barber_services" 
ON public.barber_services 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow users to delete their own barber_services
CREATE POLICY "Users can delete their own barber_services" 
ON public.barber_services 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Ensure everyone can view barber services (required for public booking page)
CREATE POLICY "Anyone can view barber_services" 
ON public.barber_services 
FOR SELECT 
USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT SELECT ON public.barber_services TO anon;
GRANT ALL ON public.barber_services TO service_role;