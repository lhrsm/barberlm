-- 1. Atualizar tabela appointments com novos campos
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS management_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS customer_action_source TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_from_id UUID REFERENCES public.appointments(id);

-- Garantir que todos os agendamentos existentes tenham um token
UPDATE public.appointments SET management_token = gen_random_uuid() WHERE management_token IS NULL;

-- 2. Garantir unicidade do token
CREATE UNIQUE INDEX IF NOT EXISTS appointments_management_token_idx ON public.appointments(management_token);

-- 3. Criar política para permitir acesso público ao agendamento via token
-- Nota: RLS já está ativo na tabela appointments. Precisamos apenas da política de leitura.
DROP POLICY IF EXISTS "Public access to appointments via management_token" ON public.appointments;
CREATE POLICY "Public access to appointments via management_token" 
ON public.appointments 
FOR SELECT 
TO anon, authenticated
USING (management_token IS NOT NULL);

-- 4. Função para buscar agendamento pelo token (segurança adicional)
CREATE OR REPLACE FUNCTION public.get_appointment_by_management_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    customer_name TEXT,
    service_name TEXT,
    professional_name TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    status TEXT,
    business_name TEXT,
    business_phone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        c.name as customer_name,
        s.name as service_name,
        b.name as professional_name,
        a.start_time,
        a.status,
        p.business_name,
        p.whatsapp_number as business_phone
    FROM public.appointments a
    JOIN public.customers c ON a.customer_id = c.id
    JOIN public.services s ON a.service_id = s.id
    JOIN public.barbers b ON a.barber_id = b.id
    JOIN public.profiles p ON a.tenant_id = p.id
    WHERE a.management_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_management_token(UUID) TO anon, authenticated;
