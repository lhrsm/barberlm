CREATE TABLE IF NOT EXISTS public.automation_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    appointment_id UUID REFERENCES public.appointments(id),
    raw_payload JSONB NOT NULL,
    type TEXT,
    fromMe BOOLEAN,
    phone TEXT,
    messageId TEXT,
    referenceMessageId TEXT,
    buttonId TEXT,
    buttonText TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.automation_webhook_logs TO authenticated;
GRANT ALL ON public.automation_webhook_logs TO service_role;
ALTER TABLE public.automation_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything on webhook logs" ON public.automation_webhook_logs FOR ALL USING (true) WITH CHECK (true);

-- Ensure automation_logs has callback tracking fields
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'automation_logs' AND column_name = 'callback_received') THEN
        ALTER TABLE public.automation_logs ADD COLUMN callback_received BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'automation_logs' AND column_name = 'callback_received_at') THEN
        ALTER TABLE public.automation_logs ADD COLUMN callback_received_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'automation_logs' AND column_name = 'button_id') THEN
        ALTER TABLE public.automation_logs ADD COLUMN button_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'automation_logs' AND column_name = 'final_status') THEN
        ALTER TABLE public.automation_logs ADD COLUMN final_status TEXT;
    END IF;
END $$;