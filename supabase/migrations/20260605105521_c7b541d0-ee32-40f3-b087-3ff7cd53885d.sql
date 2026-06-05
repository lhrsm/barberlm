CREATE TABLE public.automation_v2_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    appointment_group_id UUID, -- For multi-appointments
    workflow_key TEXT NOT NULL,
    flow_type TEXT NOT NULL DEFAULT 'single',
    phone TEXT NOT NULL,
    customer_name TEXT,
    message_id TEXT, -- provider_message_id
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    payload JSONB,
    provider_response JSONB,
    
    -- Callback info
    callback_received BOOLEAN DEFAULT false,
    callback_received_at TIMESTAMP WITH TIME ZONE,
    callback_button_id TEXT,
    callback_payload JSONB,
    
    -- Session status
    session_id UUID REFERENCES automation_conversations(id) ON DELETE SET NULL,
    current_step TEXT,
    error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX idx_auto_v2_disp_tenant ON public.automation_v2_dispatches(tenant_id);
CREATE INDEX idx_auto_v2_disp_appt ON public.automation_v2_dispatches(appointment_id);
CREATE INDEX idx_auto_v2_disp_msg ON public.automation_v2_dispatches(message_id);
CREATE INDEX idx_auto_v2_disp_created ON public.automation_v2_dispatches(created_at);

-- Enable RLS
ALTER TABLE public.automation_v2_dispatches ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_v2_dispatches TO authenticated;
GRANT ALL ON public.automation_v2_dispatches TO service_role;

-- Policy
CREATE POLICY "Tenants can manage their own v2 dispatches" ON public.automation_v2_dispatches
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM barbershops WHERE owner_id = auth.uid()
        )
    );

-- Migrate existing data from automation_send_history if possible
INSERT INTO public.automation_v2_dispatches (
    id, tenant_id, appointment_id, workflow_key, phone, 
    message_id, status, sent_at, payload, provider_response, 
    session_id, created_at
)
SELECT 
    id, 
    tenant_id, 
    appointment_id, 
    automation_name as workflow_key, 
    phone, 
    provider_message_id as message_id, 
    status, 
    created_at as sent_at, 
    payload, 
    zapi_response as provider_response,
    conversation_id as session_id,
    created_at
FROM public.automation_send_history
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_v2_dispatches_updated_at
    BEFORE UPDATE ON public.automation_v2_dispatches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
