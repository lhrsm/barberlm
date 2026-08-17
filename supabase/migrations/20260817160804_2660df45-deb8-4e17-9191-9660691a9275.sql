
-- Fix resource visibility for administrators and staff
-- Barbers: ensure tenant admins and super admins can manage/view
DROP POLICY IF EXISTS "Public select for active barbers" ON public.barbers;
CREATE POLICY "Public select for active barbers" ON public.barbers FOR SELECT TO public USING (active = true OR tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Services: ensure visibility
DROP POLICY IF EXISTS "Public select for services" ON public.services;
CREATE POLICY "Public select for services" ON public.services FOR SELECT TO public USING (true);

-- Customers: fix visibility for staff
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.customers;
CREATE POLICY "Tenant members can view customers" ON public.customers FOR SELECT TO authenticated USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Appointments: reinforced visibility (already updated, but ensuring logic includes 'tenant_admin' role explicitly)
DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;
CREATE POLICY "Tenant can view own appointments" ON public.appointments FOR ALL TO authenticated USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())) OR
  (tenant_id IN (SELECT tenant_id FROM public.reception_permissions WHERE user_id = auth.uid() AND is_active = true)) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'tenant_admin') OR
  public.has_role(auth.uid(), 'super_admin')
);

GRANT SELECT ON public.barbers TO authenticated;
GRANT SELECT ON public.services TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.appointments TO authenticated;
