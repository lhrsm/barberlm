DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'profiles' AND column_name = 'barbershop_logo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN barbershop_logo_url TEXT;
    END IF;
END $$;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO anon;
