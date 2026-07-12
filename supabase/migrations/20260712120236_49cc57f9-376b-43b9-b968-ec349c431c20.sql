
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_phone TEXT,
  tenant_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  audience TEXT NOT NULL DEFAULT 'customer',
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_subs_select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_own_subs_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_push_subs_phone ON public.push_subscriptions(customer_phone) WHERE active;
CREATE INDEX IF NOT EXISTS idx_push_subs_tenant ON public.push_subscriptions(tenant_id) WHERE active;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  _endpoint TEXT,
  _p256dh TEXT,
  _auth TEXT,
  _user_agent TEXT DEFAULT NULL,
  _customer_phone TEXT DEFAULT NULL,
  _tenant_id UUID DEFAULT NULL,
  _audience TEXT DEFAULT 'customer'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF _endpoint IS NULL OR _p256dh IS NULL OR _auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  INSERT INTO public.push_subscriptions
    (user_id, customer_phone, tenant_id, endpoint, p256dh, auth, user_agent, audience, active, last_seen_at)
  VALUES
    (v_uid, _customer_phone, _tenant_id, _endpoint, _p256dh, _auth, _user_agent, COALESCE(_audience,'customer'), true, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.push_subscriptions.user_id),
    customer_phone = COALESCE(EXCLUDED.customer_phone, public.push_subscriptions.customer_phone),
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.push_subscriptions.tenant_id),
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    audience = EXCLUDED.audience,
    active = true,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(_endpoint TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.push_subscriptions SET active = false, updated_at = now() WHERE endpoint = _endpoint;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(TEXT) TO anon, authenticated;
