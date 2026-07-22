
ALTER TABLE public.tenant_addons
  ADD COLUMN IF NOT EXISTS payment_failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_error text,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tenant_addons_payment_failed
  ON public.tenant_addons (tenant_id)
  WHERE payment_failed_count > 0;
