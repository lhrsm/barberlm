-- Adapt existing whatsapp_instances table
DO $$ 
BEGIN
    -- Rename user_id to tenant_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_instances' AND column_name = 'user_id') THEN
        ALTER TABLE public.whatsapp_instances RENAME COLUMN user_id TO tenant_id;
    END IF;

    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_instances' AND column_name = 'provider') THEN
        ALTER TABLE public.whatsapp_instances ADD COLUMN provider TEXT NOT NULL DEFAULT 'evolution';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_instances' AND column_name = 'instance_name') THEN
        ALTER TABLE public.whatsapp_instances ADD COLUMN instance_name TEXT;
        UPDATE public.whatsapp_instances SET instance_name = name WHERE instance_name IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_instances' AND column_name = 'connected') THEN
        ALTER TABLE public.whatsapp_instances ADD COLUMN connected BOOLEAN DEFAULT false;
        UPDATE public.whatsapp_instances SET connected = (status = 'open') WHERE connected IS NULL;
    END IF;
END $$;

-- Create table for email settings
CREATE TABLE IF NOT EXISTS public.email_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'resend',
    api_key TEXT,
    sender_email TEXT,
    sender_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Create table for AI settings
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'openai',
    api_key TEXT,
    model TEXT DEFAULT 'gpt-3.5-turbo',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id)
);

-- Create table for automations
CREATE TABLE IF NOT EXISTS public.automations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    channel TEXT DEFAULT 'whatsapp',
    trigger_type TEXT NOT NULL,
    trigger_delay INTEGER DEFAULT 0,
    template TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for automation logs
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id UUID,
    status TEXT NOT NULL,
    provider TEXT,
    response JSONB,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'draft',
    filters JSONB,
    total_recipients INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for campaign logs
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id UUID,
    status TEXT NOT NULL,
    response JSONB,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$ 
BEGIN
    -- WhatsApp
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can manage their own whatsapp instances') THEN
        CREATE POLICY "Tenants can manage their own whatsapp instances" ON public.whatsapp_instances FOR ALL USING (auth.uid() = tenant_id);
    END IF;

    -- Email
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can manage their own email settings') THEN
        CREATE POLICY "Tenants can manage their own email settings" ON public.email_settings FOR ALL USING (auth.uid() = tenant_id);
    END IF;

    -- AI
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can manage their own ai settings') THEN
        CREATE POLICY "Tenants can manage their own ai settings" ON public.ai_settings FOR ALL USING (auth.uid() = tenant_id);
    END IF;

    -- Automations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can manage their own automations') THEN
        CREATE POLICY "Tenants can manage their own automations" ON public.automations FOR ALL USING (auth.uid() = tenant_id);
    END IF;

    -- Logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can view their own automation logs') THEN
        CREATE POLICY "Tenants can view their own automation logs" ON public.automation_logs FOR SELECT USING (auth.uid() = tenant_id);
    END IF;

    -- Campaigns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can manage their own campaigns') THEN
        CREATE POLICY "Tenants can manage their own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = tenant_id);
    END IF;

    -- Campaign Logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants can view their own campaign logs') THEN
        CREATE POLICY "Tenants can view their own campaign logs" ON public.campaign_logs FOR SELECT USING (auth.uid() = tenant_id);
    END IF;
END $$;
