CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_profile_role() = 'super_admin', false)
$$;

DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by owner, tenant, or super admin"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR public.is_super_admin_user()
  OR (
    public.get_my_tenant_id() IS NOT NULL
    AND (
      tenant_id = public.get_my_tenant_id()
      OR id = public.get_my_tenant_id()
    )
  )
);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile or super admin can update any"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR public.is_super_admin_user())
WITH CHECK (auth.uid() = id OR public.is_super_admin_user());

CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all appointments" ON public.appointments;
CREATE POLICY "Super admins can manage all appointments"
ON public.appointments
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all barbers" ON public.barbers;
CREATE POLICY "Super admins can manage all barbers"
ON public.barbers
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all customers" ON public.customers;
CREATE POLICY "Super admins can manage all customers"
ON public.customers
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all services" ON public.services;
CREATE POLICY "Super admins can manage all services"
ON public.services
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all transactions" ON public.transactions;
CREATE POLICY "Super admins can manage all transactions"
ON public.transactions
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all products" ON public.products;
CREATE POLICY "Super admins can manage all products"
ON public.products
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all product sales" ON public.product_sales;
CREATE POLICY "Super admins can manage all product sales"
ON public.product_sales
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Super admins can manage all notifications" ON public.notifications;
CREATE POLICY "Super admins can manage all notifications"
ON public.notifications
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Audit logs insertable by super_admin" ON public.audit_logs;
CREATE POLICY "Audit logs insertable by super_admin"
ON public.audit_logs
FOR INSERT
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Audit logs viewable by super_admin" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by super_admin"
ON public.audit_logs
FOR SELECT
USING (public.is_super_admin_user());

DROP POLICY IF EXISTS "Plans manageable by super_admin" ON public.plans;
CREATE POLICY "Plans manageable by super_admin"
ON public.plans
FOR ALL
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Admin can update tickets" ON public.support_tickets;
CREATE POLICY "Admin can update tickets"
ON public.support_tickets
FOR UPDATE
USING (public.is_super_admin_user())
WITH CHECK (public.is_super_admin_user());

DROP POLICY IF EXISTS "Tenants see their own tickets" ON public.support_tickets;
CREATE POLICY "Tenants see their own tickets"
ON public.support_tickets
FOR SELECT
USING (tenant_id = auth.uid() OR public.is_super_admin_user());

DROP POLICY IF EXISTS "Insert messages if ticket owner or admin" ON public.support_messages;
CREATE POLICY "Insert messages if ticket owner or admin"
ON public.support_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.tenant_id = auth.uid()
  )
  OR public.is_super_admin_user()
);

DROP POLICY IF EXISTS "View messages if ticket owner or admin" ON public.support_messages;
CREATE POLICY "View messages if ticket owner or admin"
ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.tenant_id = auth.uid()
  )
  OR public.is_super_admin_user()
);