-- Criar tabela para logs de webhook
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbershop_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Barbearias podem ver seus próprios logs"
ON public.webhook_logs
FOR SELECT
USING (auth.uid() = barbershop_id);

-- Permitir inserção pela Edge Function (service role)
-- Como a edge function usa service role, ela ignora RLS por padrão, 
-- mas é bom ter políticas claras.

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_barbershop_id ON public.webhook_logs(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);