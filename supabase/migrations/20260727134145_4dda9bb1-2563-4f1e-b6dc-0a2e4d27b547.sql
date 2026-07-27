CREATE TABLE public.payment_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id UUID,
  method TEXT NOT NULL DEFAULT 'pix',
  amount NUMERIC(12,2),
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_via_whatsapp BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_receipts_tenant ON public.payment_receipts(tenant_id);
CREATE INDEX idx_payment_receipts_appointment ON public.payment_receipts(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own receipts"
ON public.payment_receipts FOR SELECT TO authenticated
USING (tenant_id = public.get_my_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant can insert own receipts"
ON public.payment_receipts FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant can update own receipts"
ON public.payment_receipts FOR UPDATE TO authenticated
USING (tenant_id = public.get_my_tenant_id())
WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant can delete own receipts"
ON public.payment_receipts FOR DELETE TO authenticated
USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER update_payment_receipts_updated_at
BEFORE UPDATE ON public.payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();