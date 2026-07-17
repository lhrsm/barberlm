
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
    ('support.suggestion_created',   'growth',      'Nova sugestão',                'Uma barbearia enviou uma sugestão de melhoria.',                        'info'),
    ('payment.refund_requested',     'operational', 'Reembolso solicitado',         'Pedido de reembolso pendente.',                                         'warning'),
    ('system.error_spike',           'operational', 'Pico de erros',                'Muitos erros em pouco tempo.',                                          'critical'),
    ('whatsapp.instance_disconnected','operational','WhatsApp desconectado',        'Instância Z-API de um tenant caiu.',                                    'warning'),
    ('revenue.milestone',            'financial',   'Marco de receita',             'MRR/receita bateu uma meta.',                                           'info'),
    ('payment.high_value',           'financial',   'Transação alta',               'Transação acima do limite configurado.',                                'info')
  ) AS c(event_key, category, label, description, default_severity);
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_event_catalog() TO authenticated;
