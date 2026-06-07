-- Adicionar colunas de retentativa na tabela automation_queue
ALTER TABLE public.automation_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela de logs de entrega do WhatsApp para auditoria detalhada
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id),
    queue_id UUID REFERENCES public.automation_queue(id),
    appointment_id UUID REFERENCES public.appointments(id),
    status TEXT NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    attempt_number INTEGER,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_delivery_logs TO authenticated;
GRANT ALL ON public.whatsapp_delivery_logs TO service_role;

-- RLS
ALTER TABLE public.whatsapp_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own delivery logs" 
ON public.whatsapp_delivery_logs 
FOR SELECT 
USING (tenant_id = auth.uid());

-- Criar função para calcular próximo horário de retentativa com backoff exponencial
CREATE OR REPLACE FUNCTION public.calculate_next_retry(attempts INTEGER) 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    delay_minutes INTEGER;
BEGIN
    -- Backoff exponencial: 5, 15, 60, 240 minutos
    delay_minutes := CASE 
        WHEN attempts = 1 THEN 5
        WHEN attempts = 2 THEN 15
        WHEN attempts = 3 THEN 60
        WHEN attempts = 4 THEN 240
        ELSE 1440 -- 24h fallback
    END;
    
    RETURN now() + (delay_minutes || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql;
