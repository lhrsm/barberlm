
-- =========================================
-- SUBSCRIPTION PLANS
-- =========================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'custom' CHECK (plan_type IN ('hair','beard','hair_beard','custom')),
  monthly_price NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  usage_type TEXT NOT NULL DEFAULT 'unlimited' CHECK (usage_type IN ('unlimited','limited')),
  max_uses_per_month INTEGER,
  benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_methods TEXT[] NOT NULL DEFAULT ARRAY['in_person']::text[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant ON public.subscription_plans(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE POLICY "public can view active plans" ON public.subscription_plans
  FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "auth can view active plans" ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (active = true);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CUSTOMER SUBSCRIPTIONS
-- =========================================
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_payment','past_due','canceled','expired')),
  payment_method TEXT NOT NULL DEFAULT 'in_person',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  next_billing_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  uses_this_period INTEGER NOT NULL DEFAULT 0,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cust_subs_tenant ON public.customer_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cust_subs_customer ON public.customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_subs_status ON public.customer_subscriptions(status);
-- Apenas uma assinatura ativa por cliente
CREATE UNIQUE INDEX IF NOT EXISTS uq_cust_one_active_sub
  ON public.customer_subscriptions(customer_id)
  WHERE status IN ('active','pending_payment','past_due');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.customer_subscriptions TO service_role;

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own subs" ON public.customer_subscriptions
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE TRIGGER trg_cust_subs_updated_at
  BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- SUBSCRIPTION INVOICES
-- =========================================
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','canceled')),
  payment_method TEXT NOT NULL DEFAULT 'in_person',
  due_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_inv_tenant ON public.subscription_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_inv_sub ON public.subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_inv_status ON public.subscription_invoices(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own invoices" ON public.subscription_invoices
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE TRIGGER trg_sub_inv_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- SUBSCRIPTION USAGE LOGS
-- =========================================
CREATE TABLE IF NOT EXISTS public.subscription_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  appointment_id UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_usage_sub ON public.subscription_usage_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_usage_tenant ON public.subscription_usage_logs(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_usage_appointment
  ON public.subscription_usage_logs(appointment_id)
  WHERE appointment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_usage_logs TO authenticated;
GRANT ALL ON public.subscription_usage_logs TO service_role;

ALTER TABLE public.subscription_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own usage logs" ON public.subscription_usage_logs
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

-- =========================================
-- consume_subscription_use
-- =========================================
CREATE OR REPLACE FUNCTION public.consume_subscription_use(
  p_subscription_id UUID,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;

  IF v_sub.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não está ativa');
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  IF v_plan.usage_type = 'limited' AND v_sub.uses_this_period >= COALESCE(v_plan.max_uses_per_month, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite mensal atingido');
  END IF;

  UPDATE public.customer_subscriptions
    SET uses_this_period = uses_this_period + 1, updated_at = now()
    WHERE id = p_subscription_id;

  INSERT INTO public.subscription_usage_logs (
    tenant_id, subscription_id, appointment_id, period_start, period_end
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, p_appointment_id, v_sub.current_period_start, v_sub.current_period_end
  )
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true, 'uses_this_period', v_sub.uses_this_period + 1);
END;
$$;
