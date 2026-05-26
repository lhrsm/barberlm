-- Adiciona colunas para controle de trial e planos na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '15 days'),
ADD COLUMN IF NOT EXISTS effective_plan TEXT DEFAULT 'pro',
ADD COLUMN IF NOT EXISTS selected_plan TEXT DEFAULT 'free';

-- Atualiza registros existentes para terem trial de 15 dias a partir da criação
UPDATE public.profiles 
SET 
  trial_start = created_at,
  trial_end = created_at + interval '15 days'
WHERE trial_start IS NULL;

-- Adiciona colunas para rastreamento de quem alterou o agendamento
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS updated_by_type TEXT, -- 'customer', 'barber', 'admin'
ADD COLUMN IF NOT EXISTS updated_by_id UUID;

-- Cria tabela de status de automação se não existir (usada pelo run-automations)
CREATE TABLE IF NOT EXISTS public.automation_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT DEFAULT 'idle',
    last_run_at TIMESTAMP WITH TIME ZONE,
    total_processed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    last_error TEXT,
    server_time TIMESTAMP WITH TIME ZONE,
    timezone TEXT DEFAULT 'America/Bahia',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garante que exista pelo menos um registro na automation_status
INSERT INTO public.automation_status (status)
SELECT 'idle'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_status);

-- Permissões para automation_status
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_status TO authenticated;
GRANT ALL ON public.automation_status TO service_role;
ALTER TABLE public.automation_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for authenticated" ON public.automation_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for service_role" ON public.automation_status TO service_role USING (true) WITH CHECK (true);

-- Função para verificar trials expirados e atualizar planos
CREATE OR REPLACE FUNCTION public.check_expired_trials()
RETURNS void AS $$
BEGIN
    -- Se o trial expirou e não há assinatura ativa, o plano efetivo volta para free e status para 'blocked' (opcional)
    -- Aqui apenas definimos o plano efetivo. A lógica de bloqueio será no frontend/middleware.
    UPDATE public.profiles
    SET effective_plan = 'free'
    WHERE trial_end < now() 
      AND (plan = 'free' OR plan IS NULL)
      AND effective_plan != 'free';
      
    -- Se tem plano pago no profile mas o trial ainda está ativo, o effective_plan deve ser PRO (conforme regra do usuário)
    -- Mas a regra diz: "Durante trial effective_plan = PRO mesmo que selected_plan = ELITE"
    -- E "Após trial effective_plan = selected_plan"
    UPDATE public.profiles
    SET effective_plan = 'pro'
    WHERE trial_end > now() AND effective_plan != 'pro';
    
    UPDATE public.profiles
    SET effective_plan = plan
    WHERE trial_end <= now() AND effective_plan != plan AND plan != 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
