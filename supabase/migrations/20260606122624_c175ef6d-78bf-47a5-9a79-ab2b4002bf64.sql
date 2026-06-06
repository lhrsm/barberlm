-- Add missing columns to automation_v2_dispatches
ALTER TABLE public.automation_v2_dispatches 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id),
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS zaap_id TEXT,
ADD COLUMN IF NOT EXISTS action_executed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS action_executed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS finalized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Create automation_v2_sessions table
CREATE TABLE IF NOT EXISTS public.automation_v2_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id),
    phone TEXT NOT NULL,
    flow_type TEXT NOT NULL DEFAULT 'single',
    current_step TEXT NOT NULL DEFAULT 'AWAITING_MAIN_ACTION',
    status TEXT NOT NULL DEFAULT 'active',
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    appointment_group_id UUID,
    provider_message_id TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create automation_v2_logs table
CREATE TABLE IF NOT EXISTS public.automation_v2_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_v2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_v2_logs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.automation_v2_sessions TO authenticated, service_role;
GRANT ALL ON public.automation_v2_logs TO authenticated, service_role;

-- Policies for sessions
CREATE POLICY "Tenants can manage their own v2 sessions" 
ON public.automation_v2_sessions 
FOR ALL 
TO authenticated 
USING (tenant_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Policies for logs
CREATE POLICY "Tenants can view their own v2 logs" 
ON public.automation_v2_logs 
FOR SELECT 
TO authenticated 
USING (tenant_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Trigger for updated_at on sessions
CREATE TRIGGER update_automation_v2_sessions_updated_at 
BEFORE UPDATE ON public.automation_v2_sessions 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();