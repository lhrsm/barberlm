-- Add tenant_id to barber_services if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barber_services' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.barber_services ADD COLUMN tenant_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Update existing records to set tenant_id from user_id if needed
UPDATE public.barber_services SET tenant_id = user_id WHERE tenant_id IS NULL AND user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;

-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Users can delete their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Users can view their own barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Anyone can view barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Anyone can view barber_services via public profile" ON public.barber_services;

-- Create more permissive yet secure policies
CREATE POLICY "authenticated_manage_barber_services" 
ON public.barber_services 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id OR auth.uid() = tenant_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = tenant_id);

CREATE POLICY "public_view_barber_services" 
ON public.barber_services 
FOR SELECT 
TO public 
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_barber_services_barber_id ON public.barber_services(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_service_id ON public.barber_services(service_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_tenant_id ON public.barber_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_user_id ON public.barber_services(user_id);