
CREATE OR REPLACE FUNCTION public.admin_anomaly_alerts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts jsonb := '[]'::jsonb;
  v_wa_disconnected int;
  v_gateway_failures int;
  v_automation_failures int;
  v_open_tickets int;
  v_low_reviews int;
  v_dormant_paying int;
  v_incidents_open int;
  v_stripe_recent_failures int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- WhatsApp instances disconnected on paying tenants
  SELECT count(DISTINCT wi.barbershop_id) INTO v_wa_disconnected
  FROM public.whatsapp_instances wi
  JOIN public.profiles p ON p.id = wi.barbershop_id
  WHERE COALESCE(wi.connected, false) = false
    AND COALESCE(p.plan, 'free') NOT IN ('free', 'trial');

  IF v_wa_disconnected > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'whatsapp_disconnected',
      'severity', CASE WHEN v_wa_disconnected >= 5 THEN 'critical' ELSE 'warning' END,
      'title', 'WhatsApp desconectado em barbearias pagantes',
      'description', v_wa_disconnected || ' barbearia(s) com plano pago estão sem WhatsApp conectado.',
      'count', v_wa_disconnected,
      'action_label', 'Ver barbearias',
      'action_route', '/admin/tenants'
    );
  END IF;

  -- Payment gateway failures (24h)
  SELECT count(*) INTO v_gateway_failures
  FROM public.payment_gateway_logs
  WHERE created_at > now() - interval '24 hours'
    AND (status ILIKE '%fail%' OR status ILIKE '%error%' OR status = 'declined');

  IF v_gateway_failures >= 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'gateway_failures',
      'severity', CASE WHEN v_gateway_failures >= 10 THEN 'critical' ELSE 'warning' END,
      'title', 'Falhas em gateways de pagamento (24h)',
      'description', v_gateway_failures || ' transação(ões) falharam nas últimas 24h.',
      'count', v_gateway_failures,
      'action_label', 'Ver logs',
      'action_route', '/admin/errors'
    );
  END IF;

  -- Automation failures (24h)
  SELECT count(*) INTO v_automation_failures
  FROM public.automation_logs
  WHERE created_at > now() - interval '24 hours'
    AND status IN ('failed', 'error');

  IF v_automation_failures >= 10 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'automation_failures',
      'severity', CASE WHEN v_automation_failures >= 50 THEN 'critical' ELSE 'warning' END,
      'title', 'Automações falhando',
      'description', v_automation_failures || ' automação(ões) falharam nas últimas 24h.',
      'count', v_automation_failures,
      'action_label', 'Ver logs',
      'action_route', '/admin/errors'
    );
  END IF;

  -- Support tickets open > 48h
  SELECT count(*) INTO v_open_tickets
  FROM public.support_tickets
  WHERE status IN ('open', 'pending', 'aberto', 'pendente')
    AND created_at < now() - interval '48 hours';

  IF v_open_tickets > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'stale_tickets',
      'severity', CASE WHEN v_open_tickets >= 5 THEN 'critical' ELSE 'warning' END,
      'title', 'Tickets sem resposta há mais de 48h',
      'description', v_open_tickets || ' ticket(s) de suporte parados.',
      'count', v_open_tickets,
      'action_label', 'Abrir suporte',
      'action_route', '/admin/support'
    );
  END IF;

  -- Low reviews last 7d
  SELECT count(*) INTO v_low_reviews
  FROM public.appointment_reviews
  WHERE created_at > now() - interval '7 days'
    AND rating IS NOT NULL
    AND rating <= 2;

  IF v_low_reviews >= 3 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'low_reviews',
      'severity', 'warning',
      'title', 'Avaliações baixas na semana',
      'description', v_low_reviews || ' avaliação(ões) com 1-2 estrelas nos últimos 7 dias.',
      'count', v_low_reviews,
      'action_label', 'Ver relatórios',
      'action_route', '/admin/reports'
    );
  END IF;

  -- Paying tenants dormant 14+ days
  SELECT count(*) INTO v_dormant_paying
  FROM public.profiles p
  WHERE COALESCE(p.plan, 'free') NOT IN ('free', 'trial')
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.barbershop_id = p.id
        AND a.created_at > now() - interval '14 days'
    );

  IF v_dormant_paying > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'dormant_paying',
      'severity', CASE WHEN v_dormant_paying >= 3 THEN 'critical' ELSE 'warning' END,
      'title', 'Barbearias pagantes sem atividade',
      'description', v_dormant_paying || ' pagante(s) sem agendamentos há 14+ dias — risco de churn.',
      'count', v_dormant_paying,
      'action_label', 'Ver barbearias',
      'action_route', '/admin/tenants'
    );
  END IF;

  -- Open status incidents
  SELECT count(*) INTO v_incidents_open
  FROM public.status_incidents
  WHERE status NOT IN ('resolved', 'closed');

  IF v_incidents_open > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'open_incidents',
      'severity', 'critical',
      'title', 'Incidentes de status abertos',
      'description', v_incidents_open || ' incidente(s) na status page.',
      'count', v_incidents_open,
      'action_label', 'Ver status',
      'action_route', '/admin/status'
    );
  END IF;

  -- Recent Stripe subscription failures (past_due / unpaid)
  SELECT count(*) INTO v_stripe_recent_failures
  FROM public.subscriptions
  WHERE status IN ('past_due', 'unpaid', 'incomplete_expired')
    AND updated_at > now() - interval '7 days';

  IF v_stripe_recent_failures > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'stripe_dunning',
      'severity', CASE WHEN v_stripe_recent_failures >= 3 THEN 'critical' ELSE 'warning' END,
      'title', 'Assinaturas com pagamento pendente',
      'description', v_stripe_recent_failures || ' assinatura(s) em dunning (past_due/unpaid).',
      'count', v_stripe_recent_failures,
      'action_label', 'Ver assinaturas',
      'action_route', '/admin/subscriptions'
    );
  END IF;

  RETURN jsonb_build_object(
    'alerts', v_alerts,
    'total', jsonb_array_length(v_alerts),
    'critical_count', (
      SELECT count(*) FROM jsonb_array_elements(v_alerts) e
      WHERE e->>'severity' = 'critical'
    ),
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_anomaly_alerts() TO authenticated;
