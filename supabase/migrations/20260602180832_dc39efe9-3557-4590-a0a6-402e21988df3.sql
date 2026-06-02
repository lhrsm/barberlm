ALTER TABLE public.zapi_webhook_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS phone_raw TEXT,
ADD COLUMN IF NOT EXISTS phone_normalized_8 TEXT;

COMMENT ON COLUMN public.zapi_webhook_logs.phone_raw IS 'Telefone bruto recebido no payload';
COMMENT ON COLUMN public.zapi_webhook_logs.phone_normalized_8 IS 'Telefone normalizado com 8 dígitos (fallback)';
COMMENT ON COLUMN public.zapi_webhook_logs.metadata IS 'Informações extras de processamento (conversa encontrada, IDs, etc)';
