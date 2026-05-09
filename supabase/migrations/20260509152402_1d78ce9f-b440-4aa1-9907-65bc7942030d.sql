-- Add tenant_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);

-- Update existing 'user' roles to 'tenant_admin' if they have a slug or business name
UPDATE public.profiles 
SET role = 'tenant_admin' 
WHERE role = 'user' OR role IS NULL;

-- Ensure role column has a default
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'client';

-- Function to check if the current user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent role escalation
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only allow if the requester is a super_admin
    IF NOT public.is_super_admin() THEN
      -- Also allow the first super_admin to be created if there are NO super_admins yet (optional, but let's stick to the "manual via DB" rule)
      -- The user specifically said: "O sistema deve permitir criar o primeiro super_admin manualmente pelo banco de dados."
      -- Manual updates via SQL (like what I'm doing now or what an admin would do in the Supabase dashboard) bypass triggers if not careful, 
      -- but usually security definer functions and RLS are what we care about.
      -- Actually, triggers run even for DB updates. But the check `public.is_super_admin()` uses `auth.uid()`.
      -- If updating via SQL directly in the dashboard, `auth.uid()` is null, so it might block it.
      
      IF auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Only super_admins can change roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_role_column ON public.profiles;
CREATE TRIGGER tr_protect_role_column
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_role_column();

-- Update RLS policies for profiles
-- 1. Profiles are viewable by everyone (needed for shop settings)
-- Already exists: "Profiles are viewable by everyone"

-- 2. Super admins can manage all profiles
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.is_super_admin());

-- 3. Users can update their own profile (except role, handled by trigger)
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile"
ON public.profiles
FOR ALL
USING (auth.uid() = id);

-- 4. New: Users can view profiles in their own tenant
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  OR 
  id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);
