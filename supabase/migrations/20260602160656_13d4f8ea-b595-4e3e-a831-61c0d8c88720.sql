-- Add template_multiple column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'template_multiple') THEN
        ALTER TABLE public.automations ADD COLUMN template_multiple TEXT;
    END IF;
END $$;

-- Fix existing confirmation templates
UPDATE public.automations
SET 
  template = 'Olá {{customer_name}} 👋

Seu agendamento na {{barbershop_name}} foi realizado com sucesso.

📋 Resumo do agendamento:

✅ Serviço: {{service_name}}
💈 Profissional: {{professional_name}}
📅 Data: {{appointment_date}}
⏰ Horário: {{appointment_time}}
{{#if service_price}}💰 Valor: {{service_price}}{{/if}}

O que deseja fazer?',
  template_multiple = 'Olá {{customer_name}} 👋

Você possui {{appointment_count}} agendamentos na {{barbershop_name}}.

📋 Resumo dos agendamentos:

{{appointments_list}}

O que deseja fazer?'
WHERE type = 'appointment_confirmation';
