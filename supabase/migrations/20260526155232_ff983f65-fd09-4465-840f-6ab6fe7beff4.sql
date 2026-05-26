-- Drop existing potentially restrictive or misconfigured policies
DROP POLICY IF EXISTS "Users can insert their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Users can delete their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Users can update their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Anyone can view barber_services" ON public.barber_services;

-- 1. Policy for INSERT: Ensure user can only insert records with their own user_id
CREATE POLICY "Users can insert their own barber_services"
ON public.barber_services
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Policy for DELETE: Ensure user can only delete their own records
CREATE POLICY "Users can delete their own barber_services"
ON public.barber_services
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Policy for SELECT: Allow anyone to view (needed for public booking)
CREATE POLICY "Anyone can view barber_services"
ON public.barber_services
FOR SELECT
USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Grant standard permissions
GRANT SELECT, INSERT, DELETE ON public.barber_services TO authenticated;
GRANT SELECT ON public.barber_services TO anon;
GRANT ALL ON public.barber_services TO service_role;