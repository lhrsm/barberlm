
-- Services catalog
CREATE TABLE public.status_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'core',
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  manual_status TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.status_services TO anon, authenticated;
GRANT ALL ON public.status_services TO service_role;
ALTER TABLE public.status_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_services public read" ON public.status_services FOR SELECT USING (true);
CREATE POLICY "status_services admin write" ON public.status_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Checks history
CREATE TABLE public.status_checks (
  id BIGSERIAL PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.status_services(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  latency_ms INT,
  success BOOLEAN NOT NULL DEFAULT true,
  message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_checks_service_time ON public.status_checks(service_id, checked_at DESC);
GRANT SELECT ON public.status_checks TO anon, authenticated;
GRANT ALL ON public.status_checks TO service_role;
ALTER TABLE public.status_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_checks public read" ON public.status_checks FOR SELECT USING (true);

-- Incidents
CREATE TABLE public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'minor',
  status TEXT NOT NULL DEFAULT 'investigating',
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.status_incidents TO anon, authenticated;
GRANT ALL ON public.status_incidents TO service_role;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_incidents public read" ON public.status_incidents FOR SELECT USING (true);
CREATE POLICY "status_incidents admin write" ON public.status_incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Maintenances
CREATE TABLE public.status_maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT NOT NULL DEFAULT 'low',
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.status_maintenances TO anon, authenticated;
GRANT ALL ON public.status_maintenances TO service_role;
ALTER TABLE public.status_maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_maintenances public read" ON public.status_maintenances FOR SELECT USING (true);
CREATE POLICY "status_maintenances admin write" ON public.status_maintenances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER trg_status_services_updated BEFORE UPDATE ON public.status_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_status_incidents_updated BEFORE UPDATE ON public.status_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_status_maintenances_updated BEFORE UPDATE ON public.status_maintenances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed services
INSERT INTO public.status_services (slug, name, category, description, display_order) VALUES
  ('frontend', 'Frontend', 'apps', 'Site público e landing page', 1),
  ('admin-panel', 'Painel Administrativo', 'apps', 'Painel das barbearias', 2),
  ('client-portal', 'Portal do Cliente', 'apps', 'Área do cliente assinante', 3),
  ('barber-panel', 'Painel do Barbeiro', 'apps', 'Área dos profissionais', 4),
  ('api', 'API Barbex', 'core', 'Endpoints HTTP da plataforma', 5),
  ('database', 'Banco de Dados', 'core', 'Banco Postgres principal', 6),
  ('realtime', 'Realtime', 'core', 'Atualizações em tempo real', 7),
  ('stripe', 'Stripe', 'integrations', 'Processador de pagamentos', 8),
  ('whatsapp', 'WhatsApp', 'integrations', 'Envio de mensagens', 9),
  ('storage', 'Supabase Storage', 'core', 'Armazenamento de arquivos', 10),
  ('uploads', 'Uploads', 'core', 'Upload de imagens e mídia', 11),
  ('notifications', 'Notificações', 'core', 'Sistema de notificações', 12),
  ('automations', 'Automações', 'core', 'Motor de automações', 13),
  ('ai', 'IA', 'integrations', 'Assistentes e geração com IA', 14)
ON CONFLICT (slug) DO NOTHING;
