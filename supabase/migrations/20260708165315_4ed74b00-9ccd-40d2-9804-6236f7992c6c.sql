
-- Novo template para o CLIENTE em appointment.created (antes só existiam barber/shop)
DO $$
DECLARE
  t RECORD;
  v_customer TEXT := E'Olá {customer_name}! 👋\n\nSeu agendamento na *{barbershop_name}* foi realizado com sucesso.\n\n📋 *Resumo do agendamento*\n\n✂️ *Serviço:* {service_name}\n💈 *Profissional:* {professional_name}\n📅 *Data:* {appointment_date}\n🕒 *Horário:* {appointment_time}\n💳 *Forma de pagamento:* {payment_method}\n💰 *Valor:* {service_price}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *Seu agendamento já está confirmado.*\nNenhuma ação é necessária caso todas as informações estejam corretas.\n\nCaso precise alterar qualquer informação, utilize o link abaixo para *gerenciar seu agendamento*.\n\nVocê poderá:\n• 📅 Reagendar o atendimento\n• ❌ Cancelar o atendimento\n• 👀 Consultar os detalhes do agendamento\n\n🔗 {management_link}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nAgradecemos pela preferência.\nEsperamos por você!\n\nEquipe *{barbershop_name}* 🤝';
  v_barber TEXT := E'Olá {professional_name}! 🧔\n\nVocê recebeu um novo agendamento.\n\n📋 *Resumo do atendimento*\n\n👤 *Cliente:* {customer_name}\n✂️ *Serviço:* {service_name}\n📅 *Data:* {appointment_date}\n🕒 *Horário:* {appointment_time}\n📞 *Telefone:* {customer_phone}\n💳 *Forma de pagamento:* {payment_method}\n💰 *Valor:* {service_price}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCaso seja necessário realizar alguma alteração, utilize o link abaixo para *gerenciar este agendamento*.\n\nVocê poderá:\n• 📅 Reagendar\n• ❌ Cancelar\n• 👀 Consultar os detalhes\n\n🔗 {management_link}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nDesejamos um excelente atendimento! ✨';
  v_shop TEXT := E'Olá! 📣\n\nUm novo agendamento foi realizado.\n\n📋 *Resumo do agendamento*\n\n👤 *Cliente:* {customer_name}\n✂️ *Serviço:* {service_name}\n💰 *Valor:* {service_price}\n💳 *Forma de pagamento:* {payment_method}\n💈 *Profissional:* {professional_name}\n📅 *Data:* {appointment_date}\n🕒 *Horário:* {appointment_time}\n📞 *Telefone:* {customer_phone}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCaso seja necessário realizar alguma alteração, utilize o link abaixo para *gerenciar este agendamento*.\n\nVocê poderá:\n• 📅 Reagendar\n• ❌ Cancelar\n• 👀 Consultar todos os detalhes\n\n🔗 {management_link}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nMensagem enviada automaticamente pelo *Barbex*.';
BEGIN
  FOR t IN SELECT id FROM public.profiles LOOP
    -- Cliente (novo template - antes não existia)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.customer', 'appointment.created.customer', 'appointment.created', 'whatsapp', true, v_customer, 'customer', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template;

    -- Barbeiro (atualiza texto para o novo padrão premium)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.barber', 'appointment.created.barber', 'appointment.created', 'whatsapp', true, v_barber, 'barber', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template;

    -- Barbearia (atualiza texto para o novo padrão premium)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.shop', 'appointment.created.shop', 'appointment.created', 'whatsapp', true, v_shop, 'shop', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template;
  END LOOP;
END $$;
