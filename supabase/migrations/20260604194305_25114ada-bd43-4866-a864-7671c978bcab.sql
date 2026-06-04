CREATE TABLE IF NOT EXISTS public.automation_send_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id),
    appointment_id UUID REFERENCES public.appointments(id),
    automation_name TEXT,
    event_name TEXT,
    source TEXT, -- automatic / test_manual
    channel TEXT DEFAULT 'whatsapp',
    phone TEXT,
    status TEXT,
    provider_message_id TEXT,
    payload JSONB,
    zapi_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_send_history TO authenticated;
GRANT ALL ON public.automation_send_history TO service_role;
ALTER TABLE public.automation_send_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can view their own send history" ON public.automation_send_history
    FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can insert their own send history" ON public.automation_send_history
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

-- Ensure automation_webhook_logs has tenant_id and appointment_id
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_webhook_logs' AND column_name='tenant_id') THEN
        ALTER TABLE public.automation_webhook_logs ADD COLUMN tenant_id UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_webhook_logs' AND column_name='appointment_id') THEN
        ALTER TABLE public.automation_webhook_logs ADD COLUMN appointment_id UUID REFERENCES public.appointments(id);
    END IF;
END $$;

-- Policies for automation_webhook_logs
ALTER TABLE public.automation_webhook_logs ENABLE ROW LEVEL SECURITY;
-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can view their own webhook logs') THEN
        CREATE POLICY "Tenants can view their own webhook logs" ON public.automation_webhook_logs
            FOR SELECT USING (tenant_id = auth.uid());
    END IF;
END $$;
