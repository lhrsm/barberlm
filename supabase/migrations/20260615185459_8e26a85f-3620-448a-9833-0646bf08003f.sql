
-- 1) Add token fields to customer_subscriptions
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS card_token TEXT,
  ADD COLUMN IF NOT EXISTS card_token_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS card_token_revoked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_subscriptions_card_token
  ON public.customer_subscriptions(card_token)
  WHERE card_token IS NOT NULL;

-- Backfill tokens for existing rows
UPDATE public.customer_subscriptions
   SET card_token = encode(gen_random_bytes(24), 'hex'),
       card_token_issued_at = now()
 WHERE card_token IS NULL;

-- Auto-generate token on insert
CREATE OR REPLACE FUNCTION public.set_subscription_card_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.card_token IS NULL THEN
    NEW.card_token := encode(gen_random_bytes(24), 'hex');
    NEW.card_token_issued_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_subscription_card_token ON public.customer_subscriptions;
CREATE TRIGGER trg_set_subscription_card_token
  BEFORE INSERT ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_card_token();

-- 2) subscription_card_scans
CREATE TABLE IF NOT EXISTS public.subscription_card_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID,
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  scanned_by UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  reason TEXT,
  ip TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_card_scans_tenant ON public.subscription_card_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_card_scans_subscription ON public.subscription_card_scans(subscription_id);
CREATE INDEX IF NOT EXISTS idx_card_scans_scanned_at ON public.subscription_card_scans(scanned_at DESC);

GRANT SELECT, INSERT ON public.subscription_card_scans TO authenticated;
GRANT ALL ON public.subscription_card_scans TO service_role;

ALTER TABLE public.subscription_card_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own card scans" ON public.subscription_card_scans;
CREATE POLICY "tenant reads own card scans" ON public.subscription_card_scans
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user());

DROP POLICY IF EXISTS "tenant inserts card scans" ON public.subscription_card_scans;
CREATE POLICY "tenant inserts card scans" ON public.subscription_card_scans
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

-- 3) Public token validation function (returns sanitized data + logs the scan)
CREATE OR REPLACE FUNCTION public.validate_subscription_card(
  p_token TEXT,
  p_scanned_by UUID DEFAULT NULL,
  p_log BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_customer RECORD;
  v_last_use TIMESTAMPTZ;
  v_remaining INTEGER;
  v_result TEXT;
  v_reason TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE card_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found');
  END IF;

  IF v_sub.card_token_revoked_at IS NOT NULL THEN
    v_result := 'revoked'; v_reason := 'token_revoked';
  ELSIF v_sub.status = 'canceled' THEN
    v_result := 'invalid'; v_reason := 'subscription_canceled';
  ELSIF v_sub.status = 'expired' THEN
    v_result := 'invalid'; v_reason := 'subscription_expired';
  ELSIF v_sub.status = 'paused' THEN
    v_result := 'paused'; v_reason := 'subscription_paused';
  ELSIF v_sub.status = 'active' THEN
    v_result := 'valid';
  ELSE
    v_result := 'pending'; v_reason := v_sub.status;
  END IF;

  SELECT id, name, photo_url, phone INTO v_customer
    FROM public.customers WHERE id = v_sub.customer_id;

  SELECT id, name, plan_type, monthly_price, usage_type, max_uses_per_month, benefits
    INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  SELECT MAX(used_at) INTO v_last_use FROM public.subscription_usage_logs
    WHERE subscription_id = v_sub.id;

  IF v_plan.usage_type = 'limited' THEN
    v_remaining := GREATEST(0, COALESCE(v_plan.max_uses_per_month, 0) - COALESCE(v_sub.uses_this_period, 0));
  ELSE
    v_remaining := NULL;
  END IF;

  IF p_log THEN
    INSERT INTO public.subscription_card_scans(
      tenant_id, customer_id, subscription_id, scanned_by, result, reason
    ) VALUES (
      v_sub.tenant_id, v_sub.customer_id, v_sub.id, p_scanned_by, v_result, v_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', v_result = 'valid',
    'result', v_result,
    'reason', v_reason,
    'subscription_id', v_sub.id,
    'tenant_id', v_sub.tenant_id,
    'status', v_sub.status,
    'current_period_end', v_sub.current_period_end,
    'paused_until', v_sub.pause_until,
    'customer', CASE WHEN v_customer.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_customer.name,
      'photo_url', v_customer.photo_url,
      'phone_masked', CASE WHEN v_customer.phone IS NULL THEN NULL
        ELSE regexp_replace(v_customer.phone, '(\d{2})(\d+)(\d{4})', '\1*****\3') END
    ) END,
    'plan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_plan.name,
      'plan_type', v_plan.plan_type,
      'monthly_price', v_plan.monthly_price,
      'usage_type', v_plan.usage_type,
      'max_uses_per_month', v_plan.max_uses_per_month,
      'benefits', v_plan.benefits
    ) END,
    'uses_this_period', v_sub.uses_this_period,
    'remaining_uses', v_remaining,
    'last_use', v_last_use
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_subscription_card(TEXT, UUID, BOOLEAN) TO anon, authenticated;

-- 4) Regenerate / revoke token
CREATE OR REPLACE FUNCTION public.regenerate_subscription_card_token(
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
  v_new TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions
    WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_sub.tenant_id <> v_uid AND NOT public.is_super_admin_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_new := encode(gen_random_bytes(24), 'hex');
  UPDATE public.customer_subscriptions
     SET card_token = v_new,
         card_token_issued_at = now(),
         card_token_revoked_at = NULL,
         updated_at = now()
   WHERE id = p_subscription_id;
  RETURN jsonb_build_object('success', true, 'card_token', v_new);
END;
$$;
