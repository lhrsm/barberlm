-- 1) payment_gateways
CREATE TABLE public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  name text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  methods jsonb NOT NULL DEFAULT '{"pix":true,"credit_card":false,"debit_card":false,"cash":false,"payment_link":false,"in_person":false}'::jsonb,
  pix_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_url text,
  webhook_secret text,
  environment text NOT NULL DEFAULT 'production',
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  status_message text,
  last_sync_at timestamptz,
  last_event_at timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own payment_gateways"
  ON public.payment_gateways
  FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

-- Apenas um gateway principal por barbearia
CREATE UNIQUE INDEX one_primary_gateway_per_tenant
  ON public.payment_gateways(tenant_id)
  WHERE is_primary = true;

CREATE INDEX idx_payment_gateways_tenant ON public.payment_gateways(tenant_id);

-- 2) payment_gateway_logs
CREATE TABLE public.payment_gateway_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE CASCADE,
  event text NOT NULL,
  status text NOT NULL,
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_logs TO authenticated;
GRANT ALL ON public.payment_gateway_logs TO service_role;

ALTER TABLE public.payment_gateway_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant views own payment_gateway_logs"
  ON public.payment_gateway_logs
  FOR SELECT
  USING (tenant_id = auth.uid());

CREATE POLICY "tenant inserts own payment_gateway_logs"
  ON public.payment_gateway_logs
  FOR INSERT
  WITH CHECK (tenant_id = auth.uid());

CREATE INDEX idx_payment_gateway_logs_tenant ON public.payment_gateway_logs(tenant_id, created_at DESC);
CREATE INDEX idx_payment_gateway_logs_gateway ON public.payment_gateway_logs(gateway_id, created_at DESC);

-- 3) updated_at trigger
CREATE OR REPLACE FUNCTION public.update_payment_gateway_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_gateways_updated_at
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_gateway_updated_at();

-- 4) Trigger para garantir que ao marcar um como principal, os outros do mesmo tenant deixem de ser
CREATE OR REPLACE FUNCTION public.ensure_single_primary_gateway()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.payment_gateways
       SET is_primary = false
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_primary_gateway
  BEFORE INSERT OR UPDATE OF is_primary ON public.payment_gateways
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.ensure_single_primary_gateway();