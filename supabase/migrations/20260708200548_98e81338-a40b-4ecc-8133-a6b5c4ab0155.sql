
DO $$
DECLARE
  t RECORD;
  v_created_customer TEXT := E'Olá {customer_name}! 👋\n\nSeu agendamento na *{barbershop_name}* foi confirmado.\n\n✂️ {service_name}\n💈 {professional_name}\n📅 {appointment_date} às {appointment_time}\n💳 {payment_method} • 💰 {service_price}\n\nEstá tudo certo. Nenhuma ação é necessária.\n\nPara reagendar, cancelar ou ver detalhes:\n{management_link}\n\nAté breve! 🤝';
  v_created_barber TEXT := E'Olá {professional_name}! 🧔\n\nNovo atendimento agendado.\n\n👤 Cliente: {customer_name}\n📞 Telefone: {customer_phone}\n✂️ Serviço: {service_name}\n📅 {appointment_date} às {appointment_time}\n💳 {payment_method} • 💰 {service_price}\n\nGerenciar:\n{management_link}';
  v_created_shop TEXT := E'Olá {recipient_name}! 📣\n\nNovo agendamento realizado.\n\n👤 Cliente: {customer_name}\n📞 Telefone: {customer_phone}\n💈 Profissional: {professional_name}\n✂️ Serviço: {service_name}\n📅 {appointment_date} às {appointment_time}\n💳 Pagamento: {payment_method}\n💰 Valor: {service_price}\n\nGerenciar agendamento:\n{management_link}\n\nMensagem automática do Barbex.';
  v_completed_customer TEXT := E'Obrigado por escolher a *{barbershop_name}*! 💈\n\nSeu atendimento foi concluído com sucesso.\n\nEsperamos receber você novamente em breve. 🤝';
  v_completed_shop TEXT := E'✅ Atendimento concluído\n\n👤 Cliente: {customer_name}\n💈 Profissional: {professional_name}\n✂️ Serviço: {service_name}\n💰 Valor: {service_price}\n💳 Pagamento: {payment_method}\n\nMensagem automática do Barbex.';
  v_review_customer TEXT := E'Olá {customer_name}! ⭐\n\nComo foi seu atendimento na *{barbershop_name}*?\n\nSua opinião ajuda a melhorar nossa experiência.\n\nAvaliar atendimento:\n{review_link}\n\nObrigado! 🤝';
BEGIN
  FOR t IN SELECT id FROM public.profiles LOOP
    -- appointment.created: cliente / barbeiro / barbearia (versões curtas)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.customer', 'appointment.created.customer', 'appointment.created', 'whatsapp', true, v_created_customer, 'customer', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;

    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.barber', 'appointment.created.barber', 'appointment.created', 'whatsapp', true, v_created_barber, 'barber', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;

    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.created.shop', 'appointment.created.shop', 'appointment.created', 'whatsapp', true, v_created_shop, 'shop', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;

    -- appointment.completed: cliente (agradecimento curto, sem avaliação)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.completed.customer', 'appointment.completed.customer', 'appointment.completed', 'whatsapp', true, v_completed_customer, 'customer', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;

    -- appointment.completed: barbearia
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.completed.shop', 'appointment.completed.shop', 'appointment.completed', 'whatsapp', true, v_completed_shop, 'shop', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;

    -- appointment.completed: avaliação (delay 15min - tratado no emitter)
    INSERT INTO public.automation_templates (tenant_id, name, key, trigger_event, channel, active, template, recipient, category)
    VALUES (t.id, 'appointment.completed.review.customer', 'appointment.completed.review.customer', 'appointment.completed', 'whatsapp', true, v_review_customer, 'customer', 'agendamentos')
    ON CONFLICT (tenant_id, key) DO UPDATE SET template = EXCLUDED.template, active = true;
  END LOOP;
END $$;
