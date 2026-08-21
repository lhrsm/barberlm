-- ==============================================================================
-- BARBEX MIGRATION: HOTFIX 15A — BACKEND RBAC HARDENING & IDENTITY PROTECTION
-- ==============================================================================

-- 1. Helper function to check granular roles within a tenant context
CREATE OR REPLACE FUNCTION public.has_tenant_role(
  p_tenant_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Global Super Admin
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- 2. Tenant Owner (Profile ID = Tenant ID)
  IF _uid = p_tenant_id THEN
    RETURN true;
  END IF;

  -- 3. Tenant Memberships matching role
  IF EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _uid
      AND tenant_id = p_tenant_id
      AND status = 'active'
      AND role::text = ANY(p_roles)
  ) THEN
    RETURN true;
  END IF;

  -- 4. User Roles fallback for tenant members
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text = ANY(p_roles)
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _uid AND (tenant_id = p_tenant_id OR id = p_tenant_id)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- 2. Helper function to resolve barber_id for current authenticated user
CREATE OR REPLACE FUNCTION public.get_barber_id_for_auth_user(
  p_tenant_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.barbers
  WHERE user_id = auth.uid()
    AND (tenant_id = p_tenant_id OR user_id = p_tenant_id)
  LIMIT 1;
$$;

-- 3. Hardening RLS on TRANSACTIONS table (Strictly Admin & Financial - Barber/Reception DENIED)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own transactions' AND tablename = 'transactions') THEN
    DROP POLICY "Users can manage own transactions" ON public.transactions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own transactions' AND tablename = 'transactions') THEN
    DROP POLICY "Users can manage their own transactions" ON public.transactions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant staff view transactions' AND tablename = 'transactions') THEN
    DROP POLICY "Tenant staff view transactions" ON public.transactions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant admin manage transactions' AND tablename = 'transactions') THEN
    DROP POLICY "Tenant admin manage transactions" ON public.transactions;
  END IF;
END $$;

CREATE POLICY "Tenant staff view transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'financial', 'finance'])
);

CREATE POLICY "Tenant admin manage transactions"
ON public.transactions FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'financial', 'finance'])
)
WITH CHECK (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'financial', 'finance'])
);

-- 4. Hardening RLS on APPOINTMENTS table
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant members view appointments' AND tablename = 'appointments') THEN
    DROP POLICY "Tenant members view appointments" ON public.appointments;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant staff update appointments' AND tablename = 'appointments') THEN
    DROP POLICY "Tenant staff update appointments" ON public.appointments;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant admin delete appointments' AND tablename = 'appointments') THEN
    DROP POLICY "Tenant admin delete appointments" ON public.appointments;
  END IF;
END $$;

-- Policy: Select appointments (Admin, Manager, Reception full; Barber own-only; Client own-only)
CREATE POLICY "Tenant members view appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'manager', 'reception', 'receptionist'])
  OR (barber_id IS NOT NULL AND barber_id = public.get_barber_id_for_auth_user(COALESCE(tenant_id, user_id)))
  OR (customer_id IS NOT NULL AND customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()))
);

-- Policy: Update appointments (Admin, Manager, Reception full; Barber own-only; Client own-only)
CREATE POLICY "Tenant staff update appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'manager', 'reception', 'receptionist'])
  OR (barber_id IS NOT NULL AND barber_id = public.get_barber_id_for_auth_user(COALESCE(tenant_id, user_id)))
  OR (customer_id IS NOT NULL AND customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()))
)
WITH CHECK (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin', 'manager', 'reception', 'receptionist'])
  OR (barber_id IS NOT NULL AND barber_id = public.get_barber_id_for_auth_user(COALESCE(tenant_id, user_id)))
  OR (customer_id IS NOT NULL AND customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()))
);

-- Policy: Delete appointments (Admin / Tenant Admin only)
CREATE POLICY "Tenant admin delete appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_tenant_role(COALESCE(tenant_id, user_id), ARRAY['admin', 'tenant_admin'])
);

-- 5. Hardening RLS on CASHBACK_TRANSACTIONS (Customer view own; Tenant admin/financial view all)
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant admin and customer view cashback' AND tablename = 'cashback_transactions') THEN
    DROP POLICY "Tenant admin and customer view cashback" ON public.cashback_transactions;
  END IF;
END $$;

CREATE POLICY "Tenant admin and customer view cashback"
ON public.cashback_transactions FOR SELECT
TO authenticated
USING (
  tenant_id = auth.uid()
  OR public.has_tenant_role(tenant_id, ARRAY['admin', 'tenant_admin', 'financial', 'finance'])
  OR (customer_id IS NOT NULL AND customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()))
);
