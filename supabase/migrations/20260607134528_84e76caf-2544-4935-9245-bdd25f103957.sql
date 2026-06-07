-- Insert the new automation template for each shop owner (tenant_admin or barber)
-- Using COALESCE(tenant_id, id) to ensure we have a valid ID for the tenant context
INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, channel, active, template, requires_callback)
SELECT DISTINCT COALESCE(tenant_id, id), 'barbershop_anniversary', 'Aniversário da Barbearia', 'barbershop.anniversary', 'whatsapp', true, 
'Olá {customer_name} 🎉

Hoje é aniversário da {barbershop_name}! 💈

E quem ganha presente é você.

Para comemorar com a gente, você recebeu um cupom especial para usar em nossos produtos ou serviços na barbearia.

🎁 Cupom: FESTEJE10

Aproveite hoje e venha celebrar esse momento com a gente!', false
FROM public.profiles
WHERE role IN ('tenant_admin', 'barber')
ON CONFLICT (tenant_id, key) DO NOTHING;
