
-- ============================================================
-- FASE 1: Fluxos conversacionais - Interações e histórico
-- ============================================================

-- 1. Tabela de interações (botões inteligentes por automação)
CREATE TABLE public.automation_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_template_id UUID REFERENCES public.automation_templates(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
  button_title TEXT NOT NULL,
  button_icon TEXT,
  button_color TEXT DEFAULT 'gray',
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_message TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_interactions_action_type_check CHECK (
    action_type IN (
      'confirm_appointment','reschedule_appointment','cancel_appointment',
      'open_portal','open_public_page','review',
      'renew_subscription','change_plan','buy_product',
      'talk_to_shop','webhook','edge_function','api_call','start_flow'
    )
  ),
  CONSTRAINT automation_interactions_color_check CHECK (
    button_color IN ('green','blue','red','gold','gray')
  ),
  CONSTRAINT automation_interactions_parent_check CHECK (
    (automation_template_id IS NOT NULL) OR (automation_id IS NOT NULL)
  )
);

CREATE INDEX idx_automation_interactions_template ON public.automation_interactions(automation_template_id) WHERE automation_template_id IS NOT NULL;
CREATE INDEX idx_automation_interactions_automation ON public.automation_interactions(automation_id) WHERE automation_id IS NOT NULL;
CREATE INDEX idx_automation_interactions_tenant ON public.automation_interactions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_interactions TO authenticated;
GRANT ALL ON public.automation_interactions TO service_role;

ALTER TABLE public.automation_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage their own automation interactions"
  ON public.automation_interactions
  FOR ALL
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Admins can manage all automation interactions"
  ON public.automation_interactions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_automation_interactions_updated_at
  BEFORE UPDATE ON public.automation_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de eventos/histórico de interações
CREATE TABLE public.automation_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES public.automation_interactions(id) ON DELETE SET NULL,
  dispatch_id UUID,
  appointment_id UUID,
  customer_id UUID,
  customer_phone TEXT,
  workflow_key TEXT,
  event_type TEXT NOT NULL,
  response_text TEXT,
  response_time_ms INTEGER,
  ip TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_interaction_events_type_check CHECK (
    event_type IN ('sent','delivered','read','clicked','replied','timeout','failed','action_executed')
  )
);

CREATE INDEX idx_automation_interaction_events_tenant ON public.automation_interaction_events(tenant_id, created_at DESC);
CREATE INDEX idx_automation_interaction_events_interaction ON public.automation_interaction_events(interaction_id);
CREATE INDEX idx_automation_interaction_events_dispatch ON public.automation_interaction_events(dispatch_id);
CREATE INDEX idx_automation_interaction_events_workflow ON public.automation_interaction_events(workflow_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_interaction_events TO authenticated;
GRANT ALL ON public.automation_interaction_events TO service_role;

ALTER TABLE public.automation_interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view their own interaction events"
  ON public.automation_interaction_events
  FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Tenants insert their own interaction events"
  ON public.automation_interaction_events
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Admins manage all interaction events"
  ON public.automation_interaction_events
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Campos de tempo de espera nas automações
ALTER TABLE public.automation_templates
  ADD COLUMN IF NOT EXISTS wait_response_timeout_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS wait_timeout_interaction_id UUID REFERENCES public.automation_interactions(id) ON DELETE SET NULL;

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS wait_response_timeout_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS wait_timeout_interaction_id UUID REFERENCES public.automation_interactions(id) ON DELETE SET NULL;
