ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_gateway_provider TEXT,
ADD COLUMN IF NOT EXISTS payment_gateway_key TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#7c3aed',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#f4f4f5',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Update existing profiles to have a default slug if they don't have one
UPDATE public.profiles SET slug = LOWER(REPLACE(business_name, ' ', '-')) || '-' || SUBSTRING(id::text, 1, 4) WHERE slug IS NULL;
