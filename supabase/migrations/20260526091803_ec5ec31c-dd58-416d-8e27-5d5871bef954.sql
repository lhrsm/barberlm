-- Add barber_id to whatsapp_connections
ALTER TABLE public.whatsapp_connections ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES auth.users(id);

-- Add barber_id to automations
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES auth.users(id);

-- Add barber_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES auth.users(id);

-- Update existing data
UPDATE public.whatsapp_connections SET barber_id = barbershop_id WHERE barber_id IS NULL AND barbershop_id IS NOT NULL;
UPDATE public.automations SET barber_id = tenant_id WHERE barber_id IS NULL AND tenant_id IS NOT NULL;
UPDATE public.whatsapp_instances SET barber_id = tenant_id WHERE barber_id IS NULL AND tenant_id IS NOT NULL;
