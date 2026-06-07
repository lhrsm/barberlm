-- Helper function to find customers with birthday today regardless of year
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

-- Create default automation templates for reminders and birthdays for all existing profiles (tenants)
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
