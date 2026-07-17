
-- 1) Estender catálogo de eventos admin com novos triggers
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
    ('tenant.signup',                 'growth',      'Novo cadastro',                'Uma nova barbearia se cadastrou na plataforma.',                     'info'),
    ('tenant.onboarding_completed',   'growth',      'Onboarding concluído',         'Barbearia completou o setup inicial.',                                'info'),
    ('tenant.first_appointment',      'growth',      'Primeiro agendamento',         'Barbearia registrou o primeiro agendamento.',                         'info'),
    ('subscription.created',          'growth',      'Nova assinatura',              'Uma nova assinatura SaaS foi paga.',                                  'info'),
    ('subscription.upgraded',         'growth',      'Upgrade de plano',             'Cliente subiu de plano.',                                             'info'),
    ('subscription.cancelled',        'risk',        'Cancelamento',                 'Cliente cancelou a assinatura.',                                      'warning'),
    ('subscription.downgraded',       'risk',        'Downgrade de plano',           'Cliente trocou para plano menor.',                                    'warning'),
    ('subscription.payment_failed',   'risk',        'Falha no pagamento',           'Cobrança recorrente falhou.',                                         'critical'),
    ('trial.expiring_soon',           'risk',        'Trial expirando',              'Trial acaba em até 3 dias.',                                          'warning'),
    ('tenant.inactive_7d',            'risk',        'Tenant inativo',               'Sem login/agendamento há 7 dias.',                                    'warning'),
    ('tenant.churn_risk',             'risk',        'Risco de churn',               'Tenant com sinais fortes de cancelamento próximo.',                   'warning'),
    ('support.ticket_created',        'operational', 'Novo ticket de suporte',       'Foi aberto um novo ticket.',                                          'info'),
    ('support.ticket_urgent',         'operational', 'Ticket urgente',               'Ticket marcado como urgente.',                                        'critical'),
    ('support.suggestion_created',    'growth',      'Nova sugestão',                'Uma barbearia enviou uma sugestão de melhoria.',                      'info'),
    ('payment.refund_requested',      'operational', 'Reembolso solicitado',         'Pedido de reembolso pendente.',                                       'warning'),
    ('system.error_spike',            'operational', 'Pico de erros',                'Muitos erros em pouco tempo.',                                        'critical'),
    ('whatsapp.instance_disconnected','operational', 'WhatsApp desconectado',        'Instância Z-API de um tenant caiu.',                                  'warning'),
    ('revenue.milestone',             'financial',   'Marco de receita',             'MRR/receita bateu uma meta.',                                         'info'),
    ('payment.high_value',            'financial',   'Transação alta',               'Transação acima do limite configurado.',                              'info'),
    ('review.low_rating',             'operational', 'Avaliação baixa',              'Cliente deixou avaliação ruim (≤ 2 estrelas).',                       'warning'),
    ('automation.template_broken',    'operational', 'Template de automação com erro','Falha ao renderizar/enviar template de automação.',                    'warning'),
    ('security.suspicious_login',     'operational', 'Login suspeito',               'Login de origem incomum detectado.',                                  'warning'),
    ('finance.chargeback',            'financial',   'Chargeback recebido',          'Foi aberto um chargeback contra um pagamento.',                       'critical'),
    ('admin.digest_daily',            'digest',      'Resumo diário',                'Digest diário automático das últimas 24h.',                           'info'),
    ('admin.digest_weekly',           'digest',      'Resumo semanal',               'Digest semanal automático dos últimos 7 dias.',                       'info')
  ) AS c(event_key, category, label, description, default_severity);
$$;
GRANT EXECUTE ON FUNCTION public.list_admin_event_catalog() TO authenticated;

-- 2) Tabela de templates editáveis por evento
CREATE TABLE IF NOT EXISTS public.admin_event_templates (
  event_key   text PRIMARY KEY,
  title_tpl   text NOT NULL,
  message_tpl text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_event_templates TO authenticated;
GRANT ALL ON public.admin_event_templates TO service_role;
ALTER TABLE public.admin_event_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage event templates"
ON public.admin_event_templates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "service role full access templates"
ON public.admin_event_templates
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed defaults idempotente (INSERT ... ON CONFLICT DO NOTHING preserva edições)
INSERT INTO public.admin_event_templates (event_key, title_tpl, message_tpl) VALUES
  ('tenant.signup',                 '🎉 Novo cadastro: {{business_name}}',        'Barbearia {{business_name}} ({{email}}) acabou de se cadastrar.'),
  ('tenant.onboarding_completed',   '✅ Onboarding concluído: {{business_name}}',  '{{business_name}} finalizou o setup inicial. Pronta para agendar.'),
  ('tenant.first_appointment',      '📅 Primeiro agendamento: {{business_name}}',  '{{business_name}} registrou o primeiro agendamento na plataforma.'),
  ('subscription.created',          '💳 Nova assinatura: {{business_name}}',       'Plano {{plan}} — R$ {{amount}} recebido.'),
  ('subscription.upgraded',         '⬆️ Upgrade: {{business_name}}',              'Trocou para o plano {{plan}}.'),
  ('subscription.cancelled',        '⚠️ Cancelamento: {{business_name}}',         '{{business_name}} cancelou a assinatura.'),
  ('subscription.downgraded',       '⬇️ Downgrade: {{business_name}}',            '{{business_name}} trocou para plano menor: {{plan}}.'),
  ('subscription.payment_failed',   '🚨 Falha no pagamento: {{business_name}}',    'Cobrança de R$ {{amount}} falhou.'),
  ('trial.expiring_soon',           '⏳ Trial expirando: {{business_name}}',       'Trial acaba em {{days_left}} dias.'),
  ('tenant.inactive_7d',            '💤 Tenant inativo: {{business_name}}',        'Sem atividade há mais de 7 dias.'),
  ('tenant.churn_risk',             '🔥 Churn risk: {{business_name}}',            'Sinais fortes de cancelamento próximo.'),
  ('support.ticket_created',        '🎫 Novo ticket: {{title}}',                   '{{business_name}}: {{description}}'),
  ('support.ticket_urgent',         '🔴 URGENTE: {{title}}',                       '{{business_name}} abriu um ticket urgente: {{description}}'),
  ('support.suggestion_created',    '💡 Nova sugestão: {{title}}',                 '{{business_name}}: {{description}}'),
  ('payment.refund_requested',      '↩️ Reembolso solicitado: R$ {{amount}}',      '{{business_name}} pediu reembolso do pagamento {{payment_id}}.'),
  ('system.error_spike',            '🚨 Pico de erros detectado',                  '{{error_count}} erros na última hora.'),
  ('whatsapp.instance_disconnected','📵 WhatsApp desconectado: {{business_name}}', 'Instância Z-API caiu. Última conexão: {{last_seen}}.'),
  ('revenue.milestone',             '🏆 Marco de receita: R$ {{amount}}',          'Receita bateu meta de R$ {{amount}}.'),
  ('payment.high_value',            '💎 Transação alta: R$ {{amount}}',            '{{business_name}} — R$ {{amount}}.'),
  ('review.low_rating',             '⭐ Avaliação baixa ({{avg_rating}}): {{business_name}}', 'Cliente avaliou com {{avg_rating}} estrelas. Comentário: {{testimonial}}'),
  ('automation.template_broken',    '⚙️ Template de automação com erro: {{template}}', 'Falha ao processar {{template}} em {{business_name}}: {{error}}'),
  ('security.suspicious_login',     '🛡️ Login suspeito: {{email}}',               'Login de {{ip}} em local incomum.'),
  ('finance.chargeback',            '🚨 Chargeback: R$ {{amount}}',                'Chargeback aberto no pagamento {{payment_id}} ({{business_name}}).'),
  ('admin.digest_daily',            '📊 Resumo diário Barbex',                     '{{summary}}'),
  ('admin.digest_weekly',           '📈 Resumo semanal Barbex',                    '{{summary}}')
ON CONFLICT (event_key) DO NOTHING;

-- 3) Renderer server-side: substitui {{var}} por valores do payload
CREATE OR REPLACE FUNCTION public.render_admin_template(_event_key text, _payload jsonb, _fallback_title text, _fallback_message text)
RETURNS TABLE (title text, message text)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  tpl_row public.admin_event_templates;
  rendered_title   text;
  rendered_message text;
  k text;
  v text;
BEGIN
  SELECT * INTO tpl_row FROM public.admin_event_templates WHERE event_key = _event_key;
  IF NOT FOUND THEN
    title := _fallback_title;
    message := _fallback_message;
    RETURN NEXT;
    RETURN;
  END IF;

  rendered_title := tpl_row.title_tpl;
  rendered_message := tpl_row.message_tpl;

  IF _payload IS NOT NULL THEN
    FOR k, v IN SELECT key, COALESCE(value #>> '{}', '') FROM jsonb_each(_payload) LOOP
      rendered_title := replace(rendered_title, '{{' || k || '}}', v);
      rendered_message := replace(rendered_message, '{{' || k || '}}', v);
    END LOOP;
  END IF;

  -- Fallbacks se template ainda estiver vazio
  IF rendered_title IS NULL OR rendered_title = '' THEN rendered_title := _fallback_title; END IF;
  IF rendered_message IS NULL OR rendered_message = '' THEN rendered_message := _fallback_message; END IF;

  title := rendered_title;
  message := rendered_message;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.render_admin_template(text, jsonb, text, text) TO authenticated, service_role, anon;

-- 4) Trigger: primeiro agendamento por tenant
CREATE OR REPLACE FUNCTION public.emit_first_appointment_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tenant_uuid uuid := NEW.tenant_id;
  existing_count int;
  biz text;
BEGIN
  IF tenant_uuid IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO existing_count
  FROM public.appointments
  WHERE tenant_id = tenant_uuid AND id <> NEW.id;

  IF existing_count > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(business_name, email) INTO biz FROM public.profiles WHERE id = tenant_uuid;

  PERFORM net.http_post(
    url := (SELECT value FROM public.system_settings WHERE key = 'supabase_url' LIMIT 1),
    headers := '{}'::jsonb,
    body := jsonb_build_object('event', 'first_appointment', 'tenant_id', tenant_uuid, 'business_name', biz)
  ) WHERE false; -- placeholder no-op para evitar hard-fail se net.http_post não disponível

  INSERT INTO public.admin_event_log(event_key, severity, payload, tenant_id, recipients_count, channels_delivered)
  VALUES ('tenant.first_appointment.pending', 'info',
          jsonb_build_object('business_name', biz, 'appointment_id', NEW.id), tenant_uuid, 0, '{}'::jsonb);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_appointment ON public.appointments;
CREATE TRIGGER trg_first_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.emit_first_appointment_event();

-- 5) Digest RPC: agrega admin_event_log em janela
CREATE OR REPLACE FUNCTION public.generate_admin_digest(_hours int)
RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH win AS (
    SELECT * FROM public.admin_event_log
    WHERE created_at >= now() - (_hours || ' hours')::interval
      AND event_key NOT LIKE 'admin.digest%'
  ),
  by_evt AS (
    SELECT event_key, COUNT(*) AS n FROM win GROUP BY event_key ORDER BY 2 DESC
  ),
  new_tenants AS (
    SELECT COUNT(*) AS n FROM public.profiles WHERE created_at >= now() - (_hours || ' hours')::interval
  ),
  new_subs AS (
    SELECT COUNT(*) AS n FROM public.subscriptions WHERE created_at >= now() - (_hours || ' hours')::interval AND status IN ('active','trialing')
  ),
  new_appts AS (
    SELECT COUNT(*) AS n FROM public.appointments WHERE created_at >= now() - (_hours || ' hours')::interval
  ),
  critical AS (
    SELECT COUNT(*) AS n FROM win WHERE severity = 'critical'
  )
  SELECT jsonb_build_object(
    'window_hours', _hours,
    'new_tenants', (SELECT n FROM new_tenants),
    'new_subscriptions', (SELECT n FROM new_subs),
    'new_appointments', (SELECT n FROM new_appts),
    'critical_events', (SELECT n FROM critical),
    'total_events', (SELECT COUNT(*) FROM win),
    'top_events', COALESCE((SELECT jsonb_agg(jsonb_build_object('event', event_key, 'count', n)) FROM by_evt LIMIT 10), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.generate_admin_digest(int) TO authenticated, service_role;
