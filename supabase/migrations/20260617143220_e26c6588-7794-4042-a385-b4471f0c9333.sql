CREATE TABLE public.barbershop_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_key)
);
CREATE INDEX idx_barbershop_modules_tenant ON public.barbershop_modules(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershop_modules TO authenticated;
GRANT ALL ON public.barbershop_modules TO service_role;
ALTER TABLE public.barbershop_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage their own modules"
ON public.barbershop_modules FOR ALL TO authenticated
USING (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant staff can read their tenant modules"
ON public.barbershop_modules FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_barbershop_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER barbershop_modules_updated_at
BEFORE UPDATE ON public.barbershop_modules
FOR EACH ROW EXECUTE FUNCTION public.tg_barbershop_modules_updated_at();

CREATE TABLE public.barbershop_module_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  old_value BOOLEAN,
  new_value BOOLEAN NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_barbershop_module_logs_tenant ON public.barbershop_module_logs(tenant_id);
GRANT SELECT, INSERT ON public.barbershop_module_logs TO authenticated;
GRANT ALL ON public.barbershop_module_logs TO service_role;
ALTER TABLE public.barbershop_module_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants read their own module logs"
ON public.barbershop_module_logs FOR SELECT TO authenticated
USING (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service writes module logs"
ON public.barbershop_module_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_log_barbershop_module_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.barbershop_module_logs (tenant_id, module_key, old_value, new_value, changed_by)
    VALUES (NEW.tenant_id, NEW.module_key, NULL, NEW.enabled, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND OLD.enabled IS DISTINCT FROM NEW.enabled THEN
    INSERT INTO public.barbershop_module_logs (tenant_id, module_key, old_value, new_value, changed_by)
    VALUES (NEW.tenant_id, NEW.module_key, OLD.enabled, NEW.enabled, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER barbershop_modules_log_change
AFTER INSERT OR UPDATE ON public.barbershop_modules
FOR EACH ROW EXECUTE FUNCTION public.tg_log_barbershop_module_change();

CREATE OR REPLACE FUNCTION public.has_module(_tenant_id UUID, _module_key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.barbershop_modules
    WHERE tenant_id = _tenant_id AND module_key = _module_key), false);
$$;