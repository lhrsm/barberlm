UPDATE public.automation_templates 
SET template = 'Olá {customer_name} 👋

Passando para lembrar do seu agendamento na {barbershop_name}.

📋 Serviço: {service_name}
💈 Profissional: {professional_name}
📅 Data: {appointment_date}
⏰ Horário: {appointment_time}'
WHERE key = 'appointment_reminder';