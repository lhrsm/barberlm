-- Phase 1: Event-driven automations foundation
-- Add recipient (customer/barber/shop) and category columns to automation_templates

ALTER TABLE public.automation_templates
  ADD COLUMN IF NOT EXISTS recipient text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'agendamentos';

-- Normalize existing trigger_events to canonical dotted form
UPDATE public.automation_templates SET trigger_event = 'appointment.created' WHERE trigger_event = 'appointment_created';
UPDATE public.automation_templates SET trigger_event = 'appointment.completed' WHERE trigger_event = 'appointment_completed';

-- Backfill recipient/category based on existing keys
UPDATE public.automation_templates SET recipient = 'customer' WHERE recipient IS NULL OR recipient = '';

UPDATE public.automation_templates SET category = CASE
  WHEN trigger_event LIKE 'appointment%' THEN 'agendamentos'
  WHEN trigger_event LIKE 'subscription%' THEN 'assinaturas'
  WHEN trigger_event LIKE 'payment%' THEN 'financeiro'
  WHEN trigger_event LIKE 'cashback%' OR trigger_event LIKE 'credits%' THEN 'financeiro'
  WHEN trigger_event LIKE 'loyalty%' THEN 'fidelidade'
  WHEN trigger_event IN ('customer.birthday','barbershop.anniversary') THEN 'marketing'
  ELSE 'agendamentos'
END;

-- Drop old unique constraint (key was unique per tenant); replace with (tenant_id, key) still ok since key now embeds recipient
-- Existing constraint automation_templates_tenant_id_key_key stays valid because new keys are unique.

-- Seed new event×recipient templates for every tenant.
-- Existing keys (appointment_confirmation, post_service_review, subscription_welcome, subscription_canceled,
-- subscription_payment_failed, customer_birthday, appointment_reminder, barbershop_anniversary) remain untouched.
-- New keys use format: <event>.<recipient>

DO $$
DECLARE
  t RECORD;
  seed RECORD;
BEGIN
  FOR t IN SELECT id FROM public.profiles LOOP
    FOR seed IN
      SELECT * FROM (VALUES
        -- Agendamentos
        ('appointment.created.barber', 'appointment.created', 'barber', 'agendamentos',
          E'Novo atendimento agendado.\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date}\nHorário: {appointment_time}\nTelefone: {customer_phone}\nPlano: {subscription_name}\nPagamento: {payment_method}'),
        ('appointment.created.shop', 'appointment.created', 'shop', 'agendamentos',
          E'Novo agendamento realizado.\n\nCliente: {customer_name}\nProfissional: {professional_name}\nServiço: {service_name}\nData: {appointment_date}\nHorário: {appointment_time}\nValor: {service_price}\nPagamento: {payment_method}'),

        ('appointment.confirmed.customer', 'appointment.confirmed', 'customer', 'agendamentos',
          E'Olá {customer_name}! ✅\n\nSua presença no {barbershop_name} foi confirmada.\n\n📅 {appointment_date} às {appointment_time}\n💈 {professional_name}\n\nAté breve!'),
        ('appointment.confirmed.barber', 'appointment.confirmed', 'barber', 'agendamentos',
          E'✅ Cliente confirmou presença.\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date} às {appointment_time}'),
        ('appointment.confirmed.shop', 'appointment.confirmed', 'shop', 'agendamentos',
          E'✅ Presença confirmada.\n\nCliente: {customer_name}\nProfissional: {professional_name}\nData: {appointment_date} às {appointment_time}'),

        ('appointment.cancelled.by_customer.customer', 'appointment.cancelled.by_customer', 'customer', 'agendamentos',
          E'Olá {customer_name},\n\nSeu cancelamento no {barbershop_name} foi realizado com sucesso.\n\nEsperamos você em breve!'),
        ('appointment.cancelled.by_customer.barber', 'appointment.cancelled.by_customer', 'barber', 'agendamentos',
          E'❌ O cliente cancelou o atendimento.\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date} às {appointment_time}\nMotivo: {cancel_reason}'),
        ('appointment.cancelled.by_customer.shop', 'appointment.cancelled.by_customer', 'shop', 'agendamentos',
          E'❌ Atendimento cancelado pelo cliente.\n\nCliente: {customer_name}\nProfissional: {professional_name}\nServiço: {service_name}\nData: {appointment_date} às {appointment_time}\nMotivo: {cancel_reason}'),

        ('appointment.cancelled.by_barber.customer', 'appointment.cancelled.by_barber', 'customer', 'agendamentos',
          E'Olá {customer_name},\n\nSeu atendimento no {barbershop_name} foi cancelado pelo profissional.\n\nMotivo: {cancel_reason}\n\nEntre em contato para reagendar.'),
        ('appointment.cancelled.by_barber.shop', 'appointment.cancelled.by_barber', 'shop', 'agendamentos',
          E'⚠️ Profissional cancelou atendimento.\n\nProfissional: {professional_name}\nCliente: {customer_name}\nData: {appointment_date} às {appointment_time}\nMotivo: {cancel_reason}'),

        ('appointment.cancelled.by_shop.customer', 'appointment.cancelled.by_shop', 'customer', 'agendamentos',
          E'Olá {customer_name},\n\nInfelizmente seu atendimento no {barbershop_name} foi cancelado.\n\nMotivo: {cancel_reason}\n\nEntre em contato para reagendar.'),
        ('appointment.cancelled.by_shop.barber', 'appointment.cancelled.by_shop', 'barber', 'agendamentos',
          E'A barbearia cancelou um agendamento.\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date} às {appointment_time}'),

        ('appointment.rescheduled.by_customer.customer', 'appointment.rescheduled.by_customer', 'customer', 'agendamentos',
          E'Olá {customer_name}, seu agendamento foi reagendado.\n\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}\nProfissional: {professional_name}'),
        ('appointment.rescheduled.by_customer.barber', 'appointment.rescheduled.by_customer', 'barber', 'agendamentos',
          E'📅 Cliente reagendou.\n\nCliente: {customer_name}\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}'),
        ('appointment.rescheduled.by_customer.shop', 'appointment.rescheduled.by_customer', 'shop', 'agendamentos',
          E'📅 Reagendamento realizado.\n\nCliente: {customer_name}\nProfissional: {professional_name}\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}'),

        ('appointment.rescheduled.by_barber.customer', 'appointment.rescheduled.by_barber', 'customer', 'agendamentos',
          E'Olá {customer_name}, seu atendimento foi reagendado pelo profissional.\n\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}\nProfissional: {professional_name}'),
        ('appointment.rescheduled.by_barber.shop', 'appointment.rescheduled.by_barber', 'shop', 'agendamentos',
          E'📅 Profissional reagendou.\n\nProfissional: {professional_name}\nCliente: {customer_name}\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}'),

        ('appointment.rescheduled.by_shop.customer', 'appointment.rescheduled.by_shop', 'customer', 'agendamentos',
          E'Olá {customer_name}, o {barbershop_name} reagendou seu atendimento.\n\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}'),
        ('appointment.rescheduled.by_shop.barber', 'appointment.rescheduled.by_shop', 'barber', 'agendamentos',
          E'📅 A barbearia reagendou um atendimento.\n\nCliente: {customer_name}\nDe: {old_date} às {old_time}\nPara: {new_date} às {new_time}'),

        ('appointment.started.customer', 'appointment.started', 'customer', 'agendamentos',
          E'Olá {customer_name}! ✂️\n\nSeu atendimento no {barbershop_name} começou.\nProfissional: {professional_name}'),

        ('appointment.completed.customer', 'appointment.completed', 'customer', 'agendamentos',
          E'Obrigado por escolher a {barbershop_name}! 💈\n\nEsperamos você novamente em breve.'),
        ('appointment.completed.shop', 'appointment.completed', 'shop', 'agendamentos',
          E'✅ Atendimento concluído.\n\nCliente: {customer_name}\nProfissional: {professional_name}\nServiço: {service_name}\nValor: {service_price}\nPagamento: {payment_method}'),

        -- Financeiro
        ('payment.confirmed.customer', 'payment.confirmed', 'customer', 'financeiro',
          E'✅ Pagamento confirmado!\n\nValor: {service_price}\nForma: {payment_method}\n\nObrigado, {customer_name}!'),
        ('payment.confirmed.shop', 'payment.confirmed', 'shop', 'financeiro',
          E'💰 Pagamento recebido.\n\nCliente: {customer_name}\nValor: {service_price}\nForma: {payment_method}'),

        ('cashback.received.customer', 'cashback.received', 'customer', 'financeiro',
          E'💸 {customer_name}, você recebeu {cashback_amount} de cashback no {barbershop_name}!'),
        ('credits.received.customer', 'credits.received', 'customer', 'financeiro',
          E'🎁 {customer_name}, você recebeu {credits_amount} em créditos no {barbershop_name}!'),

        -- Assinaturas
        ('subscription.created.customer', 'subscription.created', 'customer', 'assinaturas',
          E'🎉 Bem-vindo(a) ao Clube {barbershop_name}!\n\nPlano: {plan_name}\n\nAcesse seu portal: {management_link}'),
        ('subscription.created.shop', 'subscription.created', 'shop', 'assinaturas',
          E'🎉 Novo assinante!\n\nCliente: {customer_name}\nPlano: {plan_name}'),

        ('subscription.cancelled.customer', 'subscription.cancelled', 'customer', 'assinaturas',
          E'Olá {customer_name}, sua assinatura {plan_name} foi cancelada.'),
        ('subscription.cancelled.shop', 'subscription.cancelled', 'shop', 'assinaturas',
          E'⚠️ Assinatura cancelada.\n\nCliente: {customer_name}\nPlano: {plan_name}'),

        ('subscription.renewed.customer', 'subscription.renewed', 'customer', 'assinaturas',
          E'✅ {customer_name}, sua assinatura {plan_name} foi renovada com sucesso!'),
        ('subscription.renewed.shop', 'subscription.renewed', 'shop', 'assinaturas',
          E'💚 Assinatura renovada.\n\nCliente: {customer_name}\nPlano: {plan_name}'),

        ('subscription.renewal_failed.customer', 'subscription.renewal_failed', 'customer', 'assinaturas',
          E'⚠️ {customer_name}, a renovação da sua assinatura {plan_name} falhou.\n\nMotivo: {cancel_reason}\n\nAtualize seu pagamento no portal.'),
        ('subscription.renewal_failed.shop', 'subscription.renewal_failed', 'shop', 'assinaturas',
          E'⚠️ Falha na renovação.\n\nCliente: {customer_name}\nPlano: {plan_name}\nMotivo: {cancel_reason}'),

        -- Fidelidade
        ('loyalty.reward_unlocked.customer', 'loyalty.reward_unlocked', 'customer', 'fidelidade',
          E'🏆 Parabéns {customer_name}!\n\nVocê desbloqueou: {reward_name}')
      ) AS s(key, trigger_event, recipient, category, template)
    LOOP
      INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
      VALUES (t.id, seed.key, seed.key, seed.trigger_event, 'whatsapp', false, seed.template, seed.recipient, seed.category)
      ON CONFLICT (tenant_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add helpful index for event lookups
CREATE INDEX IF NOT EXISTS idx_automation_templates_tenant_event ON public.automation_templates(tenant_id, trigger_event) WHERE active = true;