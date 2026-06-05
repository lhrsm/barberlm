ALTER TABLE public.automation_webhook_logs 
ADD COLUMN IF NOT EXISTS last_processing_step TEXT,
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Garantir que as colunas UUID existem e estão corretas (algumas podem já existir com nomes levemente diferentes, mas o usuário pediu nomes específicos)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_webhook_logs' AND column_name = 'conversation_id') THEN
        ALTER TABLE public.automation_webhook_logs ADD COLUMN conversation_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_webhook_logs' AND column_name = 'appointment_id') THEN
        ALTER TABLE public.automation_webhook_logs ADD COLUMN appointment_id UUID;
    END IF;
END $$;

COMMENT ON COLUMN public.automation_webhook_logs.last_processing_step IS 'Última etapa concluída no processamento do callback';
COMMENT ON COLUMN public.automation_webhook_logs.processing_error IS 'Detalhes do erro caso o processamento falhe';
