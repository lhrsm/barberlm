-- 1. Ensure columns exist
ALTER TABLE public.automation_queue 
ADD COLUMN IF NOT EXISTS event_name TEXT,
ADD COLUMN IF NOT EXISTS workflow_key TEXT,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- 2. Add unique indices for idempotency
-- We handle reminders (appointment_id) and birthdays (customer_id)
-- For reminders, we unique by (tenant, appointment, key, scheduled_for)
-- For birthdays, we unique by (tenant, customer, key, date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_reminders
ON public.automation_queue (tenant_id, appointment_id, workflow_key, scheduled_for)
WHERE appointment_id IS NOT NULL;

-- 3. Helper function for birthdays
CREATE OR REPLACE FUNCTION public.get_customers_with_birthday_today(target_day INTEGER, target_month INTEGER)
RETURNS TABLE (id UUID, tenant_id UUID, name TEXT, phone TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.tenant_id, c.name, c.phone
  FROM public.customers c
  WHERE EXTRACT(DAY FROM c.birth_date) = target_day
    AND EXTRACT(MONTH FROM c.birth_date) = target_month;
END;
$$;

-- 4. Create default templates for existing profiles
DO $$
DECLARE
    t_id UUID;
BEGIN
    FOR t_id IN SELECT id FROM public.profiles LOOP
        -- Appointment Reminder
        INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, channel, active, template)
        VALUES (t_id, 'appointment_reminder', 'Lembrete de Agendamento', 'appointment.reminder', 'whatsapp', true, 'Olá {customer_name} 👋\n\nPassando para lembrar do seu agendamento na {barbershop_name}.')
        ON CONFLICT (tenant_id, key) DO NOTHING;

        -- Customer Birthday
        INSERT INTO public.automation_templates (tenant_id, key, name, trigger_event, channel, active, template)
        VALUES (t_id, 'customer_birthday', 'Aniversariante do Cliente', 'customer.birthday', 'whatsapp', true, 'Olá {customer_name} 🎉\n\nA {barbershop_name} te felicita pelo seu aniversário!')
        ON CONFLICT (tenant_id, key) DO NOTHING;
    END LOOP;
END $$;
