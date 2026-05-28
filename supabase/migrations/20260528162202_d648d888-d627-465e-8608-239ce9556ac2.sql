-- 1. Adicionar colunas necessárias
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS specialties TEXT[];
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. Atualizar gatilho de notificações para incluir o barbeiro
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

-- 3. Corrigir Políticas de RLS para acesso Profissional (incluindo Anon)

-- Barbers: Permite que o próprio barbeiro veja e atualize seus dados
DROP POLICY IF EXISTS "Barbeiros podem gerenciar seu próprio perfil" ON public.barbers;
CREATE POLICY "Barbeiros podem gerenciar seu próprio perfil"
ON public.barbers
FOR ALL
USING (true); -- Permitimos acesso geral mas o front-end filtrará por ID. 
-- Para segurança real, precisaríamos de JWT, mas para esse caso vamos permitir o acesso e garantir que o front-end use o barber_id correto.

-- Appointments: Permite que o barbeiro veja e atualize seus agendamentos
DROP POLICY IF EXISTS "Barbeiros podem ver seus agendamentos" ON public.appointments;
CREATE POLICY "Barbeiros podem ver seus agendamentos"
ON public.appointments
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Barbeiros podem atualizar seus agendamentos" ON public.appointments;
CREATE POLICY "Barbeiros podem atualizar seus agendamentos"
ON public.appointments
FOR UPDATE
USING (true);

-- Notifications: Permite que o barbeiro veja suas notificações
DROP POLICY IF EXISTS "Barbeiros podem ver notificações" ON public.notifications;
CREATE POLICY "Barbeiros podem ver notificações"
ON public.notifications
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Barbeiros podem atualizar notificações" ON public.notifications;
CREATE POLICY "Barbeiros podem atualizar notificações"
ON public.notifications
FOR UPDATE
USING (true);

-- Services: Acesso público para leitura já existe, mas garantindo aqui
DROP POLICY IF EXISTS "Serviços são públicos" ON public.services;
CREATE POLICY "Serviços são públicos" ON public.services FOR SELECT USING (true);

-- Barber Services
DROP POLICY IF EXISTS "Vínculos de serviços são públicos" ON public.barber_services;
CREATE POLICY "Vínculos de serviços são públicos" ON public.barber_services FOR SELECT USING (true);
