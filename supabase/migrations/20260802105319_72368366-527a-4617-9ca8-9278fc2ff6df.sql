-- 1. Novo papel
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reception';

-- 2. Permissões da recepção
CREATE TABLE IF NOT EXISTS public.reception_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_reception_permissions_tenant ON public.reception_permissions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reception_permissions TO authenticated;
GRANT ALL ON public.reception_permissions TO service_role;

ALTER TABLE public.reception_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Lista de espera
CREATE TABLE IF NOT EXISTS public.waiting_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  preferred_date DATE,
  time_range TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant_status ON public.waiting_list(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated;
GRANT ALL ON public.waiting_list TO service_role;

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- 4. Funções auxiliares (security definer, sem recursão de RLS)
CREATE OR REPLACE FUNCTION public.reception_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.reception_permissions
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_reception(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reception_permissions
    WHERE user_id = _user_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.reception_can(_user_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> _action)::boolean
     FROM public.reception_permissions
     WHERE user_id = _user_id AND is_active = true
     LIMIT 1),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.reception_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reception_permissions_updated ON public.reception_permissions;
CREATE TRIGGER trg_reception_permissions_updated
BEFORE UPDATE ON public.reception_permissions
FOR EACH ROW EXECUTE FUNCTION public.reception_touch_updated_at();

DROP TRIGGER IF EXISTS trg_waiting_list_updated ON public.waiting_list;
CREATE TRIGGER trg_waiting_list_updated
BEFORE UPDATE ON public.waiting_list
FOR EACH ROW EXECUTE FUNCTION public.reception_touch_updated_at();

-- 5. Policies: reception_permissions
DROP POLICY IF EXISTS "Owner manages reception permissions" ON public.reception_permissions;
CREATE POLICY "Owner manages reception permissions"
ON public.reception_permissions FOR ALL TO authenticated
USING (tenant_id = public.get_my_tenant_id() OR public.is_super_admin_user())
WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_super_admin_user());

DROP POLICY IF EXISTS "Reception reads own permissions" ON public.reception_permissions;
CREATE POLICY "Reception reads own permissions"
ON public.reception_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 6. Policies: waiting_list
DROP POLICY IF EXISTS "Tenant manages waiting list" ON public.waiting_list;
CREATE POLICY "Tenant manages waiting list"
ON public.waiting_list FOR ALL TO authenticated
USING (tenant_id = public.get_my_tenant_id() OR public.is_super_admin_user())
WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_super_admin_user());

DROP POLICY IF EXISTS "Reception reads waiting list" ON public.waiting_list;
CREATE POLICY "Reception reads waiting list"
ON public.waiting_list FOR SELECT TO authenticated
USING (tenant_id = public.reception_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Reception writes waiting list" ON public.waiting_list;
CREATE POLICY "Reception writes waiting list"
ON public.waiting_list FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.reception_tenant_id(auth.uid())
  AND public.reception_can(auth.uid(), 'manage_waiting_list')
);

DROP POLICY IF EXISTS "Reception updates waiting list" ON public.waiting_list;
CREATE POLICY "Reception updates waiting list"
ON public.waiting_list FOR UPDATE TO authenticated
USING (
  tenant_id = public.reception_tenant_id(auth.uid())
  AND public.reception_can(auth.uid(), 'manage_waiting_list')
)
WITH CHECK (
  tenant_id = public.reception_tenant_id(auth.uid())
  AND public.reception_can(auth.uid(), 'manage_waiting_list')
);