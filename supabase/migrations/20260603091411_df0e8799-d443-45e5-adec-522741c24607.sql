-- Rename old tables to avoid conflicts and keep legacy data
ALTER TABLE IF EXISTS public.automation_logs RENAME TO legacy_automation_logs;
ALTER TABLE IF EXISTS public.whatsapp_conversations RENAME TO legacy_whatsapp_conversations;
ALTER TABLE IF EXISTS public.automation_conversations RENAME TO legacy_automation_conversations;

-- 1. automation_events
CREATE TABLE public.automation_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. automation_workflows
CREATE TABLE public.automation_workflows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. automation_queue
CREATE TABLE public.automation_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.automation_events(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 4. conversation_sessions
CREATE TABLE public.conversation_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    status TEXT NOT NULL DEFAULT 'active', -- active, closed
    current_step TEXT,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    appointment_group_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. automation_logs (v2)
CREATE TABLE public.automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE SET NULL,
    queue_id UUID REFERENCES public.automation_queue(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
    event_name TEXT,
    step TEXT,
    status TEXT NOT NULL, -- success, warning, error
    message TEXT,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. messaging_providers
CREATE TABLE public.messaging_providers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- zapi, evolution, meta
    instance_id TEXT,
    token TEXT,
    client_token TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_queue TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_providers TO authenticated, service_role;

-- Enable RLS
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;

-- Policies (simple tenant-based access)
CREATE POLICY "Tenants can manage their own events" ON public.automation_events USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage their own workflows" ON public.automation_workflows USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage their own queue" ON public.automation_queue USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage their own sessions" ON public.conversation_sessions USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage their own logs" ON public.automation_logs USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage their own providers" ON public.messaging_providers USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER tr_automation_workflows_updated_at BEFORE UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_conversation_sessions_updated_at BEFORE UPDATE ON public.conversation_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
