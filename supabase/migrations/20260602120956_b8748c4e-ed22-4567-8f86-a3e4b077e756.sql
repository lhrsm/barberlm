-- 1. Add missing unique constraint to notifications table
-- First, delete any duplicates that would prevent adding the constraint
DELETE FROM public.notifications n1
USING public.notifications n2
WHERE n1.id > n2.id 
  AND n1.tenant_id = n2.tenant_id 
  AND n1.type = n2.type 
  AND n1.unique_key = n2.unique_key;

-- Now add the constraint
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_tenant_type_unique_key_key UNIQUE (tenant_id, type, unique_key);

-- 2. Update trigger function to use the constraint correctly (it was already trying to use it)
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
    business_name_val TEXT;
    customer_name_val TEXT;
    service_name_val TEXT;
    notification_unique_key TEXT;
BEGIN
    -- Get business name
    SELECT business_name INTO business_name_val FROM public.profiles WHERE id = NEW.user_id;
    -- Get customer name
    SELECT name INTO customer_name_val FROM public.customers WHERE id = NEW.customer_id;
    -- Get service name
    SELECT name INTO service_name_val FROM public.services WHERE id = NEW.service_id;

    -- Chave única para evitar duplicidade
    notification_unique_key := 'appointment:' || NEW.id || ':barber:' || NEW.barber_id;

    -- Notificar o dono da barbearia
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, unique_key)
    VALUES (
        NEW.user_id,
        NEW.user_id,
        'Novo Agendamento',
        'Um novo agendamento foi realizado para ' || COALESCE(customer_name_val, 'Cliente') || ' - ' || COALESCE(service_name_val, 'Serviço'),
        'appointment',
        '/calendar',
        'appointment:' || NEW.id || ':owner'
    ) ON CONFLICT (tenant_id, type, unique_key) DO NOTHING;

    -- Notificar o barbeiro
    IF NEW.barber_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, tenant_id, barber_id, title, message, type, link, unique_key)
        VALUES (
            NEW.user_id,
            NEW.user_id,
            NEW.barber_id,
            'Novo Agendamento para Você',
            'Você tem um novo agendamento: ' || COALESCE(customer_name_val, 'Cliente') || ' - ' || COALESCE(service_name_val, 'Serviço') || ' às ' || to_char(NEW.start_time, 'HH24:MI'),
            'appointment',
            '/' || (SELECT slug FROM profiles WHERE id = NEW.user_id) || '/profissional',
            notification_unique_key
        ) ON CONFLICT (tenant_id, type, unique_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
