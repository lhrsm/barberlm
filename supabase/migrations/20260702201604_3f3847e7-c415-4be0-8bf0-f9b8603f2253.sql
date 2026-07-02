
-- Extend customer_subscriptions with provider linkage
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_payment timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_date timestamptz,
  ADD COLUMN IF NOT EXISTS amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL';

CREATE INDEX IF NOT EXISTS idx_cust_subs_provider_sub_id
  ON public.customer_subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- subscription_payments: per-charge records across all gateways
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text,
  pix_code text,
  pix_qr_code_base64 text,
  invoice_url text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant reads own subscription_payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE POLICY "tenant manages own subscription_payments"
  ON public.subscription_payments FOR ALL
  TO authenticated
  USING (tenant_id = auth.uid() OR public.is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant ON public.subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_provider_payment_id ON public.subscription_payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.subscription_payments(status);

CREATE TRIGGER trg_sub_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
