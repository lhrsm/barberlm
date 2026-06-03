-- 1. Ensure flow_type type exists
DO $$ BEGIN
    CREATE TYPE public.automation_flow_type AS ENUM ('single', 'multi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update automation_queue
ALTER TABLE public.automation_queue 
ADD COLUMN IF NOT EXISTS flow_type public.automation_flow_type,
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS entity_id UUID,
ADD COLUMN IF NOT EXISTS appointment_id UUID,
ADD COLUMN IF NOT EXISTS payload JSONB;

-- 3. Update conversation_sessions
ALTER TABLE public.conversation_sessions
ADD COLUMN IF NOT EXISTS flow_type public.automation_flow_type,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 4. Ensure automation_logs columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='flow_type') THEN
        ALTER TABLE public.automation_logs ADD COLUMN flow_type public.automation_flow_type;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='current_step_before') THEN
        ALTER TABLE public.automation_logs ADD COLUMN current_step_before TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='current_step_after') THEN
        ALTER TABLE public.automation_logs ADD COLUMN current_step_after TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='selected_option') THEN
        ALTER TABLE public.automation_logs ADD COLUMN selected_option TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='action') THEN
        ALTER TABLE public.automation_logs ADD COLUMN action TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='error') THEN
        ALTER TABLE public.automation_logs ADD COLUMN error TEXT;
    END IF;
END $$;

-- 5. Update zapi_webhook_logs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_logs' AND column_name='tenant_id') THEN
        ALTER TABLE public.zapi_webhook_logs ADD COLUMN tenant_id UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_logs' AND column_name='button_id') THEN
        ALTER TABLE public.zapi_webhook_logs ADD COLUMN button_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_logs' AND column_name='reference_message_id') THEN
        ALTER TABLE public.zapi_webhook_logs ADD COLUMN reference_message_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_logs' AND column_name='session_id') THEN
        ALTER TABLE public.zapi_webhook_logs ADD COLUMN session_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zapi_webhook_logs' AND column_name='flow_type') THEN
        ALTER TABLE public.zapi_webhook_logs ADD COLUMN flow_type public.automation_flow_type;
    END IF;
END $$;

-- 6. Ensure Policies
DROP POLICY IF EXISTS "Tenants can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Tenants can view their own automation logs" ON public.automation_logs FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can view their own webhook logs" ON public.zapi_webhook_logs;
CREATE POLICY "Tenants can view their own webhook logs" ON public.zapi_webhook_logs FOR SELECT USING (auth.uid() = tenant_id);
