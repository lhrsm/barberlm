-- Create automation_conversations table for state management
CREATE TABLE public.automation_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    automation_type TEXT NOT NULL,
    current_state TEXT NOT NULL DEFAULT 'AWAITING_MAIN_ACTION',
    appointment_ids UUID[] DEFAULT '{}',
    selected_appointment_id UUID,
    remaining_appointment_ids UUID[] DEFAULT '{}',
    last_option_id TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, expired
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create automation_dispatches table for idempotency
CREATE TABLE public.automation_dispatches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    automation_type TEXT NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
    sent_at TIMESTAMP WITH TIME ZONE,
    unique_key TEXT UNIQUE, -- e.g., tenant_id:type:appointment_id:date
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update automation_logs with additional fields
ALTER TABLE public.automation_logs 
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outgoing', -- outgoing, incoming
ADD COLUMN IF NOT EXISTS option_id TEXT,
ADD COLUMN IF NOT EXISTS payload JSONB,
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.automation_conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_conv_phone ON public.automation_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_automation_conv_tenant ON public.automation_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_disp_tenant ON public.automation_dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_disp_status ON public.automation_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant ON public.automation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_conv ON public.automation_logs(conversation_id);

-- Enable RLS
ALTER TABLE public.automation_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_dispatches ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.automation_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_conversations TO authenticated;

GRANT ALL ON public.automation_dispatches TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_dispatches TO authenticated;

-- Policies for automation_conversations
CREATE POLICY "Tenants can view their own conversations" 
ON public.automation_conversations FOR SELECT 
USING (tenant_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

-- Policies for automation_dispatches
CREATE POLICY "Tenants can view their own dispatches" 
ON public.automation_dispatches FOR SELECT 
USING (tenant_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

-- Add trigger for updated_at on automation_conversations if function exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_automation_conversations_updated_at
        BEFORE UPDATE ON public.automation_conversations
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
