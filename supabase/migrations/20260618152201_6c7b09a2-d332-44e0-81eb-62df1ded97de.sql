
-- Table: privacy_consents (LGPD)
CREATE TABLE public.privacy_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  accepted_privacy BOOLEAN NOT NULL DEFAULT false,
  allow_marketing BOOLEAN NOT NULL DEFAULT false,
  allow_notifications BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.privacy_consents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_consents TO authenticated;
GRANT ALL ON public.privacy_consents TO service_role;

ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own consent (public booking flow)
CREATE POLICY "Anyone can insert consent"
ON public.privacy_consents FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Authenticated users can view consents of their tenant or their own
CREATE POLICY "Users view own/tenant consents"
ON public.privacy_consents FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

CREATE INDEX idx_privacy_consents_tenant ON public.privacy_consents(tenant_id);
CREATE INDEX idx_privacy_consents_customer ON public.privacy_consents(customer_id);

-- LGPD preferences on customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS allow_marketing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deletion_status TEXT;
