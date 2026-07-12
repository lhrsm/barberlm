
-- Extend admin_notifications with event tracking
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_event_key
  ON public.admin_notifications(event_key, created_at DESC);

-- Per-admin subscriptions: which events, which channels
CREATE TABLE IF NOT EXISTS public.admin_event_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  channel_panel boolean NOT NULL DEFAULT true,
  channel_push boolean NOT NULL DEFAULT true,
  channel_whatsapp boolean NOT NULL DEFAULT false,
  channel_email boolean NOT NULL DEFAULT false,
  whatsapp_phone text,
  email_address text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_event_subscriptions TO authenticated;
GRANT ALL ON public.admin_event_subscriptions TO service_role;
ALTER TABLE public.admin_event_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages own event subscriptions"
  ON public.admin_event_subscriptions FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Auditable log of every admin event fired
CREATE TABLE IF NOT EXISTS public.admin_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid,
  recipients_count integer NOT NULL DEFAULT 0,
  channels_delivered jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_event_log_event_key
  ON public.admin_event_log(event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_event_log_tenant
  ON public.admin_event_log(tenant_id, created_at DESC);

GRANT SELECT ON public.admin_event_log TO authenticated;
GRANT ALL ON public.admin_event_log TO service_role;
ALTER TABLE public.admin_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read event log"
  ON public.admin_event_log FOR SELECT
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_admin_event_subs_updated ON public.admin_event_subscriptions;
CREATE TRIGGER trg_admin_event_subs_updated
  BEFORE UPDATE ON public.admin_event_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Catalog of known admin events (used by UI for the subscription screen)
CREATE OR REPLACE FUNCTION public.list_admin_event_catalog()
RETURNS TABLE (
  event_key text,
  category text,
  label text,
  description text,
  default_severity text
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('tenant.signup',                'growth',      'Novo cadastro',                'Uma nova barbearia se cadastrou na plataforma.',                       'info'),
    ('tenant.onboarding_completed',  'growth',      'Onboarding concluído',         'Barbearia completou o setup inicial.',                                  'info'),
    ('tenant.first_appointment',     'growth',      'Primeiro agendamento',         'Barbearia registrou o primeiro agendamento.',                           'info'),
    ('subscription.created',         'growth',      'Nova assinatura',              'Uma nova assinatura SaaS foi paga.',                                    'info'),
    ('subscription.upgraded',        'growth',      'Upgrade de plano',             'Cliente subiu de plano.',                                               'info'),
    ('subscription.cancelled',       'risk',        'Cancelamento',                 'Cliente cancelou a assinatura.',                                        'warning'),
    ('subscription.downgraded',      'risk',        'Downgrade de plano',           'Cliente trocou para plano menor.',                                      'warning'),
    ('subscription.payment_failed',  'risk',        'Falha no pagamento',           'Cobrança recorrente falhou.',                                           'critical'),
    ('trial.expiring_soon',          'risk',        'Trial expirando',              'Trial acaba em até 3 dias.',                                            'warning'),
    ('tenant.inactive_7d',           'risk',        'Tenant inativo',               'Sem login/agendamento há 7 dias.',                                      'warning'),
    ('support.ticket_created',       'operational', 'Novo ticket de suporte',       'Foi aberto um novo ticket.',                                            'info'),
    ('support.ticket_urgent',        'operational', 'Ticket urgente',               'Ticket marcado como urgente.',                                          'critical'),
    ('payment.refund_requested',     'operational', 'Reembolso solicitado',         'Pedido de reembolso pendente.',                                         'warning'),
    ('system.error_spike',           'operational', 'Pico de erros',                'Muitos erros em pouco tempo.',                                          'critical'),
    ('whatsapp.instance_disconnected','operational','WhatsApp desconectado',        'Instância Z-API de um tenant caiu.',                                    'warning'),
    ('revenue.milestone',            'financial',   'Marco de receita',             'MRR/receita bateu uma meta.',                                           'info'),
    ('payment.high_value',           'financial',   'Transação alta',               'Transação acima do limite configurado.',                                'info')
  ) AS c(event_key, category, label, description, default_severity);
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_event_catalog() TO authenticated;
