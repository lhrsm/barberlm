
CREATE TABLE public.tenant_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_integrations TO authenticated;
GRANT ALL ON public.tenant_integrations TO service_role;

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage their own integrations"
ON public.tenant_integrations
FOR ALL
TO authenticated
USING (auth.uid() = tenant_id)
WITH CHECK (auth.uid() = tenant_id);

CREATE TRIGGER update_tenant_integrations_updated_at
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
