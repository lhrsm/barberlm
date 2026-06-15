
-- 1) Add 'paused' to status check and new fields
ALTER TABLE public.customer_subscriptions
  DROP CONSTRAINT IF EXISTS customer_subscriptions_status_check;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_status_check
  CHECK (status IN ('active','pending_payment','past_due','canceled','expired','paused'));

ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS pause_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_notes TEXT,
  ADD COLUMN IF NOT EXISTS total_paused_days INTEGER NOT NULL DEFAULT 0;

-- Update unique active-subscription index to also include 'paused'
DROP INDEX IF EXISTS public.uq_cust_one_active_sub;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cust_one_active_sub
  ON public.customer_subscriptions(customer_id)
  WHERE status IN ('active','pending_payment','past_due','paused');

-- 2) Status logs table
CREATE TABLE IF NOT EXISTS public.subscription_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  customer_id UUID,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  pause_until TIMESTAMPTZ,
  notes TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscription_status_logs_sub ON public.subscription_status_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_logs_tenant ON public.subscription_status_logs(tenant_id);

GRANT SELECT, INSERT ON public.subscription_status_logs TO authenticated;
GRANT ALL ON public.subscription_status_logs TO service_role;

ALTER TABLE public.subscription_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own status logs" ON public.subscription_status_logs;
CREATE POLICY "tenant reads own status logs" ON public.subscription_status_logs
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user());

DROP POLICY IF EXISTS "tenant inserts status logs" ON public.subscription_status_logs;
CREATE POLICY "tenant inserts status logs" ON public.subscription_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

-- 3) Pause RPC
CREATE OR REPLACE FUNCTION public.pause_customer_subscription(
  p_subscription_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_pause_until TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF v_sub.status = 'paused' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura já está pausada');
  END IF;
  IF v_sub.status NOT IN ('active','pending_payment','past_due') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só é possível pausar assinaturas ativas');
  END IF;

  UPDATE public.customer_subscriptions
     SET status = 'paused',
         paused_at = now(),
         pause_reason = p_reason,
         pause_until = p_pause_until,
         pause_notes = p_notes,
         resumed_at = NULL,
         auto_renew = false,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.subscription_status_logs(
    tenant_id, subscription_id, customer_id, old_status, new_status,
    reason, pause_until, notes, changed_by
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, v_sub.customer_id, v_sub.status, 'paused',
    p_reason, p_pause_until, p_notes, v_uid
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4) Resume RPC (recalculates current_period_end / next_billing_at adding paused days)
CREATE OR REPLACE FUNCTION public.resume_customer_subscription(
  p_subscription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
  v_paused_days INTEGER := 0;
  v_new_period_end TIMESTAMPTZ;
  v_new_next_billing TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF v_sub.status <> 'paused' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura não está pausada');
  END IF;

  v_paused_days := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_sub.paused_at)) / 86400)::int;
  v_new_period_end := v_sub.current_period_end + make_interval(days => v_paused_days);
  v_new_next_billing := COALESCE(v_sub.next_billing_at, v_sub.current_period_end) + make_interval(days => v_paused_days);

  UPDATE public.customer_subscriptions
     SET status = 'active',
         resumed_at = now(),
         current_period_end = v_new_period_end,
         next_billing_at = v_new_next_billing,
         total_paused_days = COALESCE(total_paused_days,0) + v_paused_days,
         auto_renew = true,
         updated_at = now()
   WHERE id = p_subscription_id;

  INSERT INTO public.subscription_status_logs(
    tenant_id, subscription_id, customer_id, old_status, new_status,
    reason, changed_by, metadata
  ) VALUES (
    v_sub.tenant_id, p_subscription_id, v_sub.customer_id, 'paused', 'active',
    'resumed', v_uid, jsonb_build_object('paused_days', v_paused_days, 'new_period_end', v_new_period_end)
  );

  RETURN jsonb_build_object('success', true, 'paused_days', v_paused_days, 'new_period_end', v_new_period_end);
END;
$$;

-- 5) Update loyalty rewards processing to discount paused days (skip paused subs)
-- The existing process_subscription_loyalty_rewards filters by status IN ('active','trialing'),
-- so paused subs are naturally skipped. Also expose a helper that returns effective active months.
CREATE OR REPLACE FUNCTION public.subscription_active_months(p_subscription_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_total_days NUMERIC;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_total_days := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_sub.started_at)) / 86400 - COALESCE(v_sub.total_paused_days, 0));
  RETURN FLOOR(v_total_days / 30.4375)::int;
END;
$$;
