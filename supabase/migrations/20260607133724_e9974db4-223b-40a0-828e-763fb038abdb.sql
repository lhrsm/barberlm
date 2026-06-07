-- Add opening_date to profiles (used for barbershop settings)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opening_date DATE;

-- Add requires_callback to automation_templates
ALTER TABLE public.automation_templates ADD COLUMN IF NOT EXISTS requires_callback BOOLEAN DEFAULT FALSE;

-- Update existing templates
UPDATE public.automation_templates SET requires_callback = TRUE WHERE key IN ('appointment_confirmation');

-- Add anniversary fields to automation_v2_dispatches
ALTER TABLE public.automation_v2_dispatches ADD COLUMN IF NOT EXISTS anniversary_year INTEGER;
ALTER TABLE public.automation_v2_dispatches ADD COLUMN IF NOT EXISTS anniversary_message_type TEXT;

-- Unique index for anniversary sends
CREATE UNIQUE INDEX IF NOT EXISTS idx_anniversary_uniqueness 
ON public.automation_v2_dispatches (tenant_id, customer_id, workflow_key, anniversary_year, anniversary_message_type) 
WHERE (workflow_key = 'barbershop_anniversary');

-- Insert the new automation template if not exists for each tenant
INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, channel, active, template, requires_callback)
SELECT DISTINCT tenant_id, 'barbershop_anniversary', 'Aniversário da Barbearia', 'barbershop.anniversary', 'whatsapp', true, 
'Olá {customer_name} 🎉

Hoje é aniversário da {barbershop_name}! 💈

E quem ganha presente é você.

Para comemorar com a gente, você recebeu um cupom especial para usar em nossos produtos ou serviços na barbearia.

🎁 Cupom: FESTEJE10

Aproveite hoje e venha celebrar esse momento com a gente!', false
FROM public.profiles
WHERE role IN ('tenant_admin', 'barber') AND tenant_id IS NOT NULL
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Create FESTEJE10 coupon for existing tenants
INSERT INTO public.coupons (code, type, value, active, tenant_id)
SELECT DISTINCT 'FESTEJE10', 'percentage', 10, true, tenant_id
FROM public.profiles
WHERE role IN ('tenant_admin', 'barber') AND tenant_id IS NOT NULL
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_v2_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.automation_templates TO service_role;
GRANT ALL ON public.automation_v2_dispatches TO service_role;
GRANT ALL ON public.coupons TO service_role;
