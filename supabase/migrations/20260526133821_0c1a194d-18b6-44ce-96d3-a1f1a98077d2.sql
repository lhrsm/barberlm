-- Add tenant_id to product_sales
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.profiles(id);

-- Ensure tenant_id is always filled on appointments
CREATE OR REPLACE FUNCTION public.ensure_appointment_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ensure_appointment_tenant_id ON public.appointments;
CREATE TRIGGER tr_ensure_appointment_tenant_id
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.ensure_appointment_tenant_id();

-- Backfill other tables just in case
UPDATE public.customers SET tenant_id = user_id WHERE tenant_id IS NULL;
UPDATE public.services SET tenant_id = user_id WHERE tenant_id IS NULL;
UPDATE public.barbers SET tenant_id = user_id WHERE tenant_id IS NULL;
UPDATE public.product_sales SET tenant_id = user_id WHERE tenant_id IS NULL;
