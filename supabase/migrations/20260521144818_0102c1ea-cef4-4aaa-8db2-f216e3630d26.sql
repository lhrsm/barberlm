CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saas_name TEXT DEFAULT 'Barber SaaS',
    saas_logo TEXT,
    main_url TEXT,
    maintenance_mode BOOLEAN DEFAULT false,
    stripe_secret_key TEXT,
    stripe_webhook_secret TEXT,
    admin_access_level TEXT DEFAULT 'restricted',
    two_factor_auth_enabled BOOLEAN DEFAULT false,
    audit_logs_enabled BOOLEAN DEFAULT true,
    integrations JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for super admins only
CREATE POLICY "Super admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Seed initial data
INSERT INTO public.system_settings (saas_name, main_url) 
VALUES ('Barber Premium SaaS', 'https://barbersaas.com');