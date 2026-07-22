
-- =========================================================================
-- FASE 1: Voucher Administrativo Interno (fundação)
-- =========================================================================

-- 1) Marcador de ambiente interno de testes ---------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_internal_test_tenant boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_internal_test_tenant IS
  'Marca a barbearia como ambiente interno de testes do Barbex. Apenas super admin pode alterar. Não concede acesso por si só — a isenção depende de um voucher administrativo ativo.';

-- Guard: apenas super admin pode ligar/desligar esse flag
CREATE OR REPLACE FUNCTION public.guard_internal_test_tenant_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_internal_test_tenant IS DISTINCT FROM OLD.is_internal_test_tenant THEN
    IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Somente super admin pode alterar is_internal_test_tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_internal_test_tenant_flag ON public.profiles;
CREATE TRIGGER trg_guard_internal_test_tenant_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_internal_test_tenant_flag();

-- 2) Catálogo de vouchers administrativos -----------------------------------
CREATE TABLE IF NOT EXISTS public.saas_admin_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('internal_testing')),

  -- Vínculos obrigatórios (segurança principal — não depende do código)
  specific_tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  specific_barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE CASCADE,

  -- Plano e add-ons liberados
  allowed_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  includes_all_addons boolean NOT NULL DEFAULT true,
  allowed_addon_ids uuid[] NOT NULL DEFAULT '{}',

  discount_percentage numeric(5,2) NOT NULL DEFAULT 100 CHECK (discount_percentage BETWEEN 0 AND 100),

  duration_type text NOT NULL DEFAULT 'forever' CHECK (duration_type IN ('forever','until_date')),
  starts_at timestamptz,
  expires_at timestamptz,

  requires_payment_method boolean NOT NULL DEFAULT false,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','active','failed','revoked','expired')),

  -- IDs do Stripe (test e live separados)
  stripe_coupon_id_test text,
  stripe_coupon_id_live text,
  stripe_promotion_code_id_test text,
  stripe_promotion_code_id_live text,

  created_by uuid REFERENCES auth.users(id),
  applied_by uuid REFERENCES auth.users(id),
  applied_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revocation_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um voucher internal_testing só pode existir para 1 tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_voucher_internal_tenant
  ON public.saas_admin_vouchers (specific_tenant_id)
  WHERE purpose = 'internal_testing' AND status IN ('draft','pending','active');

CREATE INDEX IF NOT EXISTS idx_admin_voucher_tenant ON public.saas_admin_vouchers(specific_tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_status ON public.saas_admin_vouchers(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admin_vouchers TO authenticated;
GRANT ALL ON public.saas_admin_vouchers TO service_role;

ALTER TABLE public.saas_admin_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_vouchers"
  ON public.saas_admin_vouchers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Permitir que o TENANT beneficiado LEIA (para mostrar o banner em /subscription)
-- Mas NUNCA escreva.
CREATE POLICY "tenant_can_view_own_voucher"
  ON public.saas_admin_vouchers
  FOR SELECT
  TO authenticated
  USING (specific_tenant_id = auth.uid());

-- 3) Registros de aplicação -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_admin_voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.saas_admin_vouchers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE SET NULL,

  stripe_customer_id text,
  stripe_subscription_id text,

  previous_plan_id uuid REFERENCES public.plans(id),
  applied_plan_id uuid REFERENCES public.plans(id),
  covered_addon_ids uuid[] NOT NULL DEFAULT '{}',

  original_monthly_amount numeric(12,2),
  discount_amount numeric(12,2),
  final_monthly_amount numeric(12,2),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','failed','revoked','expired')),

  starts_at timestamptz,
  ends_at timestamptz,

  applied_by uuid REFERENCES auth.users(id),
  applied_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revocation_reason text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Impedir que o mesmo voucher internal_testing seja aplicado em >1 tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_voucher_active
  ON public.saas_admin_voucher_redemptions (voucher_id)
  WHERE status IN ('pending','active');

CREATE INDEX IF NOT EXISTS idx_redemption_tenant ON public.saas_admin_voucher_redemptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_redemption_status ON public.saas_admin_voucher_redemptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admin_voucher_redemptions TO authenticated;
GRANT ALL ON public.saas_admin_voucher_redemptions TO service_role;

ALTER TABLE public.saas_admin_voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_redemptions"
  ON public.saas_admin_voucher_redemptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant_can_view_own_redemption"
  ON public.saas_admin_voucher_redemptions
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

-- 4) Auditoria --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_admin_voucher_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid REFERENCES public.saas_admin_vouchers(id) ON DELETE SET NULL,
  redemption_id uuid REFERENCES public.saas_admin_voucher_redemptions(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE SET NULL,

  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  actor_ip text,
  reason text,

  previous_values jsonb,
  new_values jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_voucher ON public.saas_admin_voucher_audit_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_tenant ON public.saas_admin_voucher_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_voucher_audit_created ON public.saas_admin_voucher_audit_logs(created_at DESC);

GRANT SELECT, INSERT ON public.saas_admin_voucher_audit_logs TO authenticated;
GRANT ALL ON public.saas_admin_voucher_audit_logs TO service_role;

ALTER TABLE public.saas_admin_voucher_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_audit"
  ON public.saas_admin_voucher_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "super_admin_insert_audit"
  ON public.saas_admin_voucher_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 5) Trigger updated_at ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_voucher_updated_at ON public.saas_admin_vouchers;
CREATE TRIGGER trg_admin_voucher_updated_at
  BEFORE UPDATE ON public.saas_admin_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_redemption_updated_at ON public.saas_admin_voucher_redemptions;
CREATE TRIGGER trg_admin_redemption_updated_at
  BEFORE UPDATE ON public.saas_admin_voucher_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Função de acesso: voucher ativo libera módulo? -------------------------
CREATE OR REPLACE FUNCTION public.has_active_internal_voucher(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saas_admin_voucher_redemptions r
    JOIN public.saas_admin_vouchers v ON v.id = r.voucher_id
    WHERE r.tenant_id = _tenant_id
      AND r.status = 'active'
      AND v.status = 'active'
      AND v.purpose = 'internal_testing'
      AND (v.starts_at IS NULL OR v.starts_at <= now())
      AND (
        v.duration_type = 'forever'
        OR (v.duration_type = 'until_date' AND v.expires_at > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_internal_voucher(uuid) TO authenticated, anon;
