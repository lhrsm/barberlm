-- Create barbershop_settings table
CREATE TABLE IF NOT EXISTS public.barbershop_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    instance_id TEXT,
    instance_token TEXT,
    client_token TEXT,
    whatsapp_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(barber_id)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershop_settings TO authenticated;
GRANT ALL ON public.barbershop_settings TO service_role;

-- Enable RLS
ALTER TABLE public.barbershop_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own barbershop settings" 
ON public.barbershop_settings 
FOR ALL 
TO authenticated 
USING (auth.uid() = barber_id);

-- Create trigger for updated_at
CREATE TRIGGER update_barbershop_settings_updated_at
BEFORE UPDATE ON public.barbershop_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Optional: Initial data migration from profiles
INSERT INTO public.barbershop_settings (barber_id, whatsapp_number)
SELECT id, whatsapp_number FROM public.profiles
ON CONFLICT (barber_id) DO UPDATE 
SET whatsapp_number = EXCLUDED.whatsapp_number;
