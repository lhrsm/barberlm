-- Create debug table for Z-API Webhooks
CREATE TABLE IF NOT EXISTS public.zapi_webhook_debug (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
    phone_raw TEXT,
    phone_normalized TEXT,
    message_text TEXT,
    option_id TEXT,
    payload_raw JSONB,
    headers_raw JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    matched_conversation_id UUID REFERENCES public.automation_conversations(id) ON DELETE SET NULL
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.zapi_webhook_debug TO authenticated;
GRANT ALL ON public.zapi_webhook_debug TO service_role;

-- Enable RLS
ALTER TABLE public.zapi_webhook_debug ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Tenants can view their own debug logs" 
ON public.zapi_webhook_debug 
FOR SELECT 
USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
));

-- Ensure automation_conversations has phone_normalized
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_conversations' AND column_name = 'phone_normalized') THEN
        ALTER TABLE public.automation_conversations ADD COLUMN phone_normalized TEXT;
    END IF;
END $$;
