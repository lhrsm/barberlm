-- Ensure automation_status exists and has required fields
CREATE TABLE IF NOT EXISTS public.automation_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT DEFAULT 'active',
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    total_processed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    server_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    timezone TEXT DEFAULT 'America/Bahia'
);

-- Insert a default row if not exists
INSERT INTO public.automation_status (status)
SELECT 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_status);

-- RPC to get current server time and timezone
CREATE OR REPLACE FUNCTION public.get_server_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'server_time', now(),
        'timezone', current_setting('TimeZone'),
        'br_time', now() AT TIME ZONE 'America/Bahia'
    ) INTO result;
    RETURN result;
END;
$$;

-- Ensure automation_logs is ready
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID REFERENCES public.automations(id),
    tenant_id UUID,
    barber_id UUID,
    customer_id UUID,
    appointment_id UUID,
    status TEXT, -- 'success', 'error'
    message_type TEXT,
    phone TEXT,
    original_template TEXT,
    processed_template TEXT,
    response JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster log viewing
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant_id ON public.automation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
