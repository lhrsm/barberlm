CREATE TABLE public.tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  event text NOT NULL DEFAULT 'all',
  secret text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_webhooks_tenant ON public.tenant_webhooks(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_webhooks TO authenticated;
GRANT ALL ON public.tenant_webhooks TO service_role;

ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their own webhooks"
ON public.tenant_webhooks FOR ALL
TO authenticated
USING (auth.uid() = tenant_id)
WITH CHECK (auth.uid() = tenant_id);

CREATE OR REPLACE FUNCTION public.update_tenant_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_tenant_webhooks_updated_at
BEFORE UPDATE ON public.tenant_webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_webhooks_updated_at();