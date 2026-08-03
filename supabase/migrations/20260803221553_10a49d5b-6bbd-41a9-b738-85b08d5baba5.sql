-- Create custom types for the omnichannel system
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'communication_channel_type') THEN
        CREATE TYPE public.communication_channel_type AS ENUM ('whatsapp', 'email', 'sms', 'push', 'internal', 'telegram', 'instagram');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'communication_message_status') THEN
        CREATE TYPE public.communication_message_status AS ENUM ('pending', 'queued', 'processing', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled', 'expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'communication_category') THEN
        CREATE TYPE public.communication_category AS ENUM ('transactional', 'operational', 'commercial', 'billing', 'support', 'internal', 'security');
    END IF;
END $$;

-- Communication Channels Table
-- Using profiles(id) as the tenant identifier since profiles table holds the business data in this project
CREATE TABLE IF NOT EXISTS public.communication_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type public.communication_channel_type NOT NULL,
    provider_name TEXT, 
    status TEXT DEFAULT 'not_configured', 
    is_active BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    health_status JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, type)
);

-- Communication Messages (Unified Log)
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    channel_type public.communication_channel_type NOT NULL,
    category public.communication_category DEFAULT 'operational',
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_id UUID, 
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_address TEXT NOT NULL, 
    content TEXT,
    template_id UUID, 
    status public.communication_message_status DEFAULT 'pending',
    provider_message_id TEXT, 
    provider_response JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    conversation_id UUID, 
    correlation_id UUID, 
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Communication Templates (Omnichannel)
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    category public.communication_category NOT NULL,
    channel_type public.communication_channel_type NOT NULL,
    content TEXT NOT NULL,
    subject TEXT, 
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, key, channel_type)
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_channels TO authenticated;
GRANT ALL ON public.communication_channels TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_messages TO authenticated;
GRANT ALL ON public.communication_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_templates TO authenticated;
GRANT ALL ON public.communication_templates TO service_role;

-- RLS
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own tenant communication_channels"
ON public.communication_channels FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access their own tenant communication_messages"
ON public.communication_messages FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access their own tenant communication_templates"
ON public.communication_templates FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
