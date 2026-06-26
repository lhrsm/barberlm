
-- 1. Add Stripe price ID columns to existing plans table
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_test text,
  ADD COLUMN IF NOT EXISTS stripe_price_id_live text;

CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_test ON public.plans(stripe_price_id_test) WHERE stripe_price_id_test IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_live ON public.plans(stripe_price_id_live) WHERE stripe_price_id_live IS NOT NULL;

-- 2. Audit table for checkout attempts
CREATE TABLE IF NOT EXISTS public.saas_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  stripe_price_id text NOT NULL,
  stripe_checkout_session_id text,
  status text NOT NULL DEFAULT 'pending',
  environment text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.saas_checkout_sessions TO authenticated;
GRANT ALL ON public.saas_checkout_sessions TO service_role;

ALTER TABLE public.saas_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own checkout sessions"
  ON public.saas_checkout_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own checkout sessions"
  ON public.saas_checkout_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages checkout sessions"
  ON public.saas_checkout_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_saas_checkout_tenant ON public.saas_checkout_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_checkout_session ON public.saas_checkout_sessions(stripe_checkout_session_id);

-- 3. Helper to resolve plan slug by price_id (used by webhook)
CREATE OR REPLACE FUNCTION public.get_plan_slug_by_stripe_price(_price_id text, _env text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug FROM public.plans
  WHERE (_env = 'live' AND stripe_price_id_live = _price_id)
     OR (_env = 'sandbox' AND stripe_price_id_test = _price_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_slug_by_stripe_price(text, text) TO authenticated, service_role;
