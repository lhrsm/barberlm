CREATE TABLE IF NOT EXISTS public.automation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    active BOOLEAN DEFAULT true,
    template TEXT NOT NULL,
    buttons JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, key)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_templates TO authenticated;
GRANT ALL ON public.automation_templates TO service_role;

-- RLS
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own automation_templates" 
ON public.automation_templates 
FOR ALL 
USING (auth.uid() = tenant_id)
WITH CHECK (auth.uid() = tenant_id);

-- Updated At Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_automation_templates_updated_at
    BEFORE UPDATE ON public.automation_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the initial appointment confirmation template for existing tenants (if any)
-- For the current user/tenant, we will make sure it exists via code or a separate insert if we know the tenant_id.
-- Usually, we let the frontend handle the creation of the default if it doesn't exist, or use a trigger.
