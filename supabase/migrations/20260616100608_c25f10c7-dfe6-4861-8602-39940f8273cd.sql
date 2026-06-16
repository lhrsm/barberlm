
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_subscriptions_referral_code
  ON public.customer_subscriptions(referral_code) WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_subscription_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.customer_subscriptions WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 12;
    v_attempts := v_attempts + 1;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_subscription_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_subscription_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_subscription_referral_code ON public.customer_subscriptions;
CREATE TRIGGER trg_set_subscription_referral_code
  BEFORE INSERT ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_referral_code();

UPDATE public.customer_subscriptions
SET referral_code = public.generate_subscription_referral_code()
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS public.subscription_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  referrer_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referrer_subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  referred_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_type TEXT NOT NULL DEFAULT 'free_month',
  reward_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_description TEXT,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_referrals TO authenticated;
GRANT ALL ON public.subscription_referrals TO service_role;

ALTER TABLE public.subscription_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own referrals"
  ON public.subscription_referrals FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access referrals"
  ON public.subscription_referrals FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sub_referrals_tenant ON public.subscription_referrals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_referrer ON public.subscription_referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_status ON public.subscription_referrals(status);
CREATE INDEX IF NOT EXISTS idx_sub_referrals_code ON public.subscription_referrals(referral_code);

CREATE TRIGGER trg_subscription_referrals_updated_at
  BEFORE UPDATE ON public.subscription_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_subscription_referral_code(
  p_tenant_id UUID,
  p_code TEXT,
  p_new_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;

  SELECT cs.id, cs.customer_id, cs.tenant_id, cs.status, c.name AS customer_name
  INTO v_sub
  FROM public.customer_subscriptions cs
  JOIN public.customers c ON c.id = cs.customer_id
  WHERE UPPER(cs.referral_code) = UPPER(TRIM(p_code))
    AND cs.tenant_id = p_tenant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_sub.status NOT IN ('active', 'paused', 'pending_payment') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  IF p_new_customer_id IS NOT NULL AND v_sub.customer_id = p_new_customer_id THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'self_referral');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'referrer_subscription_id', v_sub.id,
    'referrer_customer_id', v_sub.customer_id,
    'referrer_name', v_sub.customer_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_subscription_referral(
  p_subscription_id UUID,
  p_referral_code TEXT,
  p_reward_type TEXT DEFAULT 'free_month',
  p_reward_value NUMERIC DEFAULT 0,
  p_reward_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_sub RECORD;
  v_validation JSONB;
  v_ref_id UUID;
BEGIN
  SELECT * INTO v_new_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_not_found');
  END IF;

  v_validation := public.validate_subscription_referral_code(v_new_sub.tenant_id, p_referral_code, v_new_sub.customer_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_validation->>'reason');
  END IF;

  UPDATE public.customer_subscriptions
  SET referred_by_code = UPPER(TRIM(p_referral_code)),
      referred_by_subscription_id = (v_validation->>'referrer_subscription_id')::uuid
  WHERE id = p_subscription_id;

  INSERT INTO public.subscription_referrals (
    tenant_id, referrer_customer_id, referrer_subscription_id,
    referred_customer_id, subscription_id, referral_code,
    status, reward_type, reward_value, reward_description
  ) VALUES (
    v_new_sub.tenant_id,
    (v_validation->>'referrer_customer_id')::uuid,
    (v_validation->>'referrer_subscription_id')::uuid,
    v_new_sub.customer_id,
    v_new_sub.id,
    UPPER(TRIM(p_referral_code)),
    'pending',
    p_reward_type,
    COALESCE(p_reward_value, 0),
    p_reward_description
  )
  ON CONFLICT (subscription_id) DO NOTHING
  RETURNING id INTO v_ref_id;

  RETURN jsonb_build_object('success', true, 'referral_id', v_ref_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_subscription_referral_reward(p_referral_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  SELECT * INTO v_ref FROM public.subscription_referrals WHERE id = p_referral_id;
  IF NOT FOUND OR v_ref.reward_granted THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found_or_already_granted');
  END IF;

  IF v_ref.reward_type = 'free_month' AND v_ref.referrer_subscription_id IS NOT NULL THEN
    UPDATE public.customer_subscriptions
    SET current_period_end = current_period_end + INTERVAL '1 month',
        next_billing_at = COALESCE(next_billing_at, current_period_end) + INTERVAL '1 month'
    WHERE id = v_ref.referrer_subscription_id;
  ELSIF v_ref.reward_type IN ('credit', 'discount') AND v_ref.reward_value > 0 THEN
    INSERT INTO public.customer_credits (tenant_id, customer_id, amount, type, status, notes)
    VALUES (v_ref.tenant_id, v_ref.referrer_customer_id, v_ref.reward_value, 'referral_reward', 'available',
            'Recompensa por indicação de assinatura');
  ELSIF v_ref.reward_type = 'cashback' AND v_ref.reward_value > 0 THEN
    UPDATE public.customers SET cashback_balance = COALESCE(cashback_balance,0) + v_ref.reward_value
    WHERE id = v_ref.referrer_customer_id;
  END IF;

  UPDATE public.subscription_referrals
  SET reward_granted = true,
      confirmed_at = COALESCE(confirmed_at, now()),
      status = 'confirmed'
  WHERE id = p_referral_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_referral_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    SELECT * INTO v_ref FROM public.subscription_referrals
      WHERE subscription_id = NEW.id AND status = 'pending' AND reward_granted = false
      LIMIT 1;
    IF FOUND THEN
      PERFORM public.grant_subscription_referral_reward(v_ref.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirm_referral_on_activation ON public.customer_subscriptions;
CREATE TRIGGER trg_confirm_referral_on_activation
  AFTER UPDATE OF status ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_activation();
