
-- 1. Junction table: plan ↔ services
CREATE TABLE IF NOT EXISTS public.subscription_plan_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  max_uses_per_period integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_services TO authenticated;
GRANT SELECT ON public.subscription_plan_services TO anon;
GRANT ALL ON public.subscription_plan_services TO service_role;
ALTER TABLE public.subscription_plan_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own plan services" ON public.subscription_plan_services
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE POLICY "public can view plan services" ON public.subscription_plan_services
  FOR SELECT TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sps_plan ON public.subscription_plan_services(plan_id);
CREATE INDEX IF NOT EXISTS idx_sps_tenant ON public.subscription_plan_services(tenant_id);

-- 2. Appointment columns for subscription coverage
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_covered_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_amount numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appts_subscription ON public.appointments(subscription_id);

-- 3. Extend subscription_usage_logs
ALTER TABLE public.subscription_usage_logs
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS benefit_type text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS covered_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_amount numeric(10,2) NOT NULL DEFAULT 0;

-- Make period defaults safe for new inserts (use current period of subscription if not given)
ALTER TABLE public.subscription_usage_logs ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE public.subscription_usage_logs ALTER COLUMN period_end DROP NOT NULL;

GRANT SELECT ON public.subscription_usage_logs TO anon;

-- 4. Eligibility function
CREATE OR REPLACE FUNCTION public.check_subscription_eligibility(
  p_customer_id uuid,
  p_service_id uuid,
  p_tenant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_service RECORD;
  v_mapping RECORD;
  v_global_used int := 0;
  v_service_used int := 0;
  v_service_price numeric(10,2) := 0;
  v_covered numeric(10,2) := 0;
  v_extra numeric(10,2) := 0;
  v_remaining int := NULL;
  v_reason text;
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_active_subscription', false, 'reason', 'service_not_found');
  END IF;
  v_service_price := COALESCE(v_service.price, 0);

  SELECT cs.*, sp.name AS plan_name, sp.usage_type, sp.max_uses_per_month, sp.monthly_price
    INTO v_sub
  FROM public.customer_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.customer_id = p_customer_id
    AND cs.tenant_id = p_tenant_id
    AND cs.status = 'active'
  ORDER BY cs.started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_active_subscription', false,
      'service_price', v_service_price,
      'reason', 'no_subscription'
    );
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  -- Service mapping
  SELECT * INTO v_mapping
  FROM public.subscription_plan_services
  WHERE plan_id = v_sub.plan_id AND service_id = p_service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_active_subscription', true,
      'subscription_id', v_sub.id,
      'plan_id', v_plan.id,
      'plan_name', v_plan.name,
      'next_billing_date', v_sub.next_billing_at,
      'service_included', false,
      'service_price', v_service_price,
      'covered_amount', 0,
      'extra_amount_to_pay', v_service_price,
      'requires_payment', true,
      'reason', 'not_included'
    );
  END IF;

  -- Global uses (plan-level)
  IF v_plan.usage_type = 'limited' AND v_plan.max_uses_per_month IS NOT NULL THEN
    SELECT COUNT(*) INTO v_global_used
    FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id
      AND used_at >= v_sub.current_period_start
      AND used_at < v_sub.current_period_end;

    IF v_global_used >= v_plan.max_uses_per_month THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'next_billing_date', v_sub.next_billing_at,
        'service_included', true,
        'service_price', v_service_price,
        'remaining_uses', 0,
        'covered_amount', 0,
        'extra_amount_to_pay', v_service_price,
        'requires_payment', true,
        'reason', 'no_uses_left'
      );
    END IF;
    v_remaining := v_plan.max_uses_per_month - v_global_used;
  END IF;

  -- Per-service uses
  IF v_mapping.max_uses_per_period IS NOT NULL THEN
    SELECT COUNT(*) INTO v_service_used
    FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id
      AND service_id = p_service_id
      AND used_at >= v_sub.current_period_start
      AND used_at < v_sub.current_period_end;

    IF v_service_used >= v_mapping.max_uses_per_period THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'subscription_id', v_sub.id,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'next_billing_date', v_sub.next_billing_at,
        'service_included', true,
        'service_price', v_service_price,
        'remaining_uses', 0,
        'covered_amount', 0,
        'extra_amount_to_pay', v_service_price,
        'requires_payment', true,
        'reason', 'no_uses_left'
      );
    END IF;
    v_remaining := LEAST(
      COALESCE(v_remaining, 999999),
      v_mapping.max_uses_per_period - v_service_used
    );
  END IF;

  -- Covered: full price (até o valor do serviço)
  v_covered := v_service_price;
  v_extra := 0;
  v_reason := 'full_coverage';

  RETURN jsonb_build_object(
    'has_active_subscription', true,
    'subscription_id', v_sub.id,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'next_billing_date', v_sub.next_billing_at,
    'service_included', true,
    'service_price', v_service_price,
    'remaining_uses', v_remaining,
    'covered_amount', v_covered,
    'extra_amount_to_pay', v_extra,
    'requires_payment', false,
    'reason', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_subscription_eligibility(uuid, uuid, uuid) TO anon, authenticated, service_role;

-- 5. Consume benefit (called after appointment insert)
CREATE OR REPLACE FUNCTION public.consume_subscription_benefit(
  p_appointment_id uuid,
  p_subscription_id uuid,
  p_service_id uuid,
  p_covered_amount numeric,
  p_extra_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  INSERT INTO public.subscription_usage_logs (
    tenant_id, subscription_id, subscription_plan_id, customer_id, service_id,
    appointment_id, benefit_type, covered_amount, extra_amount,
    used_at, period_start, period_end
  ) VALUES (
    v_sub.tenant_id, v_sub.id, v_sub.plan_id, v_sub.customer_id, p_service_id,
    p_appointment_id, 'service', COALESCE(p_covered_amount, 0), COALESCE(p_extra_amount, 0),
    now(), v_sub.current_period_start, v_sub.current_period_end
  ) ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;

  UPDATE public.customer_subscriptions
  SET uses_this_period = uses_this_period + 1,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_subscription_benefit(uuid, uuid, uuid, numeric, numeric) TO anon, authenticated, service_role;
