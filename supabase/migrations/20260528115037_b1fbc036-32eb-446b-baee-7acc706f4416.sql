-- Create zapi_integration_logs table
CREATE TABLE public.zapi_integration_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.profiles(id),
    instance_id TEXT,
    action TEXT NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    status_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Use GRANT to set permissions for different roles.
GRANT SELECT ON public.zapi_integration_logs TO authenticated;
GRANT ALL ON public.zapi_integration_logs TO service_role;

-- Enable Row Level Security
ALTER TABLE public.zapi_integration_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own integration logs" 
ON public.zapi_integration_logs 
FOR SELECT 
USING (auth.uid() = tenant_id);

-- No insert/update/delete for users (only via service role/edge functions)
