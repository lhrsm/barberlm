
-- ============== SUBPROCESSORS ==============
CREATE TABLE IF NOT EXISTS public.subprocessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL,
  category text NOT NULL,
  country text,
  privacy_url text,
  website_url text,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subprocessors TO anon, authenticated;
GRANT ALL ON public.subprocessors TO service_role;
ALTER TABLE public.subprocessors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active subprocessors"
  ON public.subprocessors FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Super admin manages subprocessors"
  ON public.subprocessors FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============== COOKIE CONSENTS ==============
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid,
  session_id text,
  necessary boolean NOT NULL DEFAULT true,
  preferences boolean NOT NULL DEFAULT false,
  statistics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT '2026-06-27',
  ip text,
  user_agent text,
  device text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cookie_consents_tenant ON public.cookie_consents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_customer ON public.cookie_consents(customer_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_created ON public.cookie_consents(created_at DESC);

GRANT INSERT ON public.cookie_consents TO anon, authenticated;
GRANT SELECT ON public.cookie_consents TO authenticated;
GRANT ALL ON public.cookie_consents TO service_role;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cookie consent"
  ON public.cookie_consents FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users view own cookie consents"
  ON public.cookie_consents FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ============== LGPD REQUESTS ==============
CREATE TABLE IF NOT EXISTS public.lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid,
  request_type text NOT NULL CHECK (request_type IN ('export','delete','anonymize','correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','rejected')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  contact_email text,
  notes text,
  ip text,
  user_agent text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_requests_tenant ON public.lgpd_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_customer ON public.lgpd_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON public.lgpd_requests(status);

GRANT SELECT, INSERT, UPDATE ON public.lgpd_requests TO authenticated;
GRANT INSERT ON public.lgpd_requests TO anon;
GRANT ALL ON public.lgpd_requests TO service_role;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit lgpd request"
  ON public.lgpd_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Customers view own requests"
  ON public.lgpd_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR tenant_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant and admin update requests"
  ON public.lgpd_requests FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    tenant_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_lgpd_requests_updated
  BEFORE UPDATE ON public.lgpd_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subprocessors_updated
  BEFORE UPDATE ON public.subprocessors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== CUSTOMERS: separate WhatsApp consents ==============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp_transactional_consent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_version_accepted text;

-- ============== SEED SUBPROCESSORS ==============
INSERT INTO public.subprocessors (name, purpose, category, country, privacy_url, website_url, sort_order) VALUES
  ('Stripe', 'Processamento de pagamentos e assinaturas', 'Pagamentos', 'Estados Unidos / Irlanda', 'https://stripe.com/br/privacy', 'https://stripe.com', 1),
  ('Lovable Cloud', 'Banco de dados, autenticação e armazenamento', 'Infraestrutura', 'Global', 'https://lovable.dev/privacy', 'https://lovable.dev', 2),
  ('Z-API', 'Integração com WhatsApp para envio de mensagens', 'Comunicação', 'Brasil', 'https://z-api.io/politica-de-privacidade', 'https://z-api.io', 3),
  ('OpenAI', 'Recursos de Inteligência Artificial (assistente e análises)', 'Inteligência Artificial', 'Estados Unidos', 'https://openai.com/policies/privacy-policy', 'https://openai.com', 4),
  ('Google Maps', 'Exibição de mapas e localização de barbearias', 'Mapas e Localização', 'Estados Unidos', 'https://policies.google.com/privacy', 'https://maps.google.com', 5),
  ('Cloudflare', 'CDN, proteção contra ataques e entrega de conteúdo', 'Infraestrutura', 'Estados Unidos', 'https://www.cloudflare.com/privacypolicy/', 'https://cloudflare.com', 6)
ON CONFLICT DO NOTHING;
