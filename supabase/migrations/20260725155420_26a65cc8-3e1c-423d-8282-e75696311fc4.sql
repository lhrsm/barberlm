
-- =========================================================
-- FASE 1 (retry): fundação add-ons cross-plan
-- =========================================================

-- 1) saas_addons
ALTER TABLE public.saas_addons
  ADD COLUMN IF NOT EXISTS annual_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_product_id_test text,
  ADD COLUMN IF NOT EXISTS stripe_product_id_live text,
  ADD COLUMN IF NOT EXISTS minimum_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

-- 2) tenant_addons: enums + colunas
DO $$ BEGIN
  CREATE TYPE public.addon_billing_cycle AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.addon_access_source AS ENUM ('addon', 'plan', 'voucher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tenant_addons
  ADD COLUMN IF NOT EXISTS billing_cycle public.addon_billing_cycle NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS access_source public.addon_access_source NOT NULL DEFAULT 'addon';

-- 3) addon_upgrade_recommendations
CREATE TABLE IF NOT EXISTS public.addon_upgrade_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  current_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  recommended_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  active_addon_ids uuid[] NOT NULL DEFAULT '{}',
  billing_cycle public.addon_billing_cycle NOT NULL DEFAULT 'monthly',
  current_option_total numeric(10,2) NOT NULL DEFAULT 0,
  upgrade_option_total numeric(10,2) NOT NULL DEFAULT 0,
  monthly_savings numeric(10,2) NOT NULL DEFAULT 0,
  annual_savings numeric(10,2) NOT NULL DEFAULT 0,
  recommendation_reason text,
  customer_action text CHECK (customer_action IN ('upgraded','kept_addons','reviewed_selection','dismissed')),
  action_taken_at timestamptz,
  shown_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addon_upgrade_rec_tenant ON public.addon_upgrade_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_upgrade_rec_created ON public.addon_upgrade_recommendations(created_at DESC);

GRANT SELECT ON public.addon_upgrade_recommendations TO authenticated;
GRANT ALL ON public.addon_upgrade_recommendations TO service_role;

ALTER TABLE public.addon_upgrade_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "tenant reads own recommendations"
  ON public.addon_upgrade_recommendations
  FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "super admin manages recommendations" ON public.addon_upgrade_recommendations;
CREATE POLICY "super admin manages recommendations"
  ON public.addon_upgrade_recommendations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_addon_upgrade_rec_updated_at ON public.addon_upgrade_recommendations;
CREATE TRIGGER trg_addon_upgrade_rec_updated_at
  BEFORE UPDATE ON public.addon_upgrade_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Configurações de billing/upgrade em tabela dedicada (singleton)
CREATE TABLE IF NOT EXISTS public.saas_billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  minimum_upgrade_savings numeric(10,2) NOT NULL DEFAULT 5.00,
  upgrade_recommendation_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.saas_billing_settings TO authenticated;
GRANT ALL ON public.saas_billing_settings TO service_role;

ALTER TABLE public.saas_billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated reads billing settings" ON public.saas_billing_settings;
CREATE POLICY "authenticated reads billing settings"
  ON public.saas_billing_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "super admin manages billing settings" ON public.saas_billing_settings;
CREATE POLICY "super admin manages billing settings"
  ON public.saas_billing_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_saas_billing_settings_updated_at ON public.saas_billing_settings;
CREATE TRIGGER trg_saas_billing_settings_updated_at
  BEFORE UPDATE ON public.saas_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.saas_billing_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
