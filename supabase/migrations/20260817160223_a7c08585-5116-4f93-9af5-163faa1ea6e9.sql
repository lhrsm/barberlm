-- Hardening RLS for appointments to ensure admin visibility
-- 1. Ensure GRANTs exist
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT SELECT ON public.appointments TO anon;

-- 2. Update/Fix the Tenant viewing policy
-- The current admin (tenant) profile has tenant_id = null, but they ARE the owner (id = tenant_id in appointments).
-- We also need to check memberships.
DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;

CREATE POLICY "Tenant can view own appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())) OR
  (tenant_id IN (SELECT tenant_id FROM public.reception_permissions WHERE user_id = auth.uid() AND is_active = true)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
);

-- 3. Ensure profiles are visible for joins
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;