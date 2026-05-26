-- Drop restrictive or broken policies
DROP POLICY IF EXISTS "Users can manage their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can delete their own barbers" ON public.barbers;

-- Create robust policies for barbers
-- Allow authenticated users to manage (INSERT, UPDATE, DELETE) their own barbers
-- We use user_id to identify the owner of the barber record
CREATE POLICY "Users can manage their own barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT SELECT ON public.barbers TO anon;
GRANT ALL ON public.barbers TO service_role;