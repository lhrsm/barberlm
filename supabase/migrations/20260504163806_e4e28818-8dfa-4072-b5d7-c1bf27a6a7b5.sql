-- Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create a view for platform stats (optional, but good for performance)
-- For now we'll query directly.

-- Update RLS policies to allow users with 'admin' role to see everything
-- This is a bit complex for a single migration without knowing all tables, 
-- but we can at least ensure the profile table allows it.

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
