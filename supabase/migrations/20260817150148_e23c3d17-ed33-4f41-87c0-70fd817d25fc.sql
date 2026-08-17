CREATE TABLE IF NOT EXISTS public.resend_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_name text NOT NULL DEFAULT 'Barbex',
    from_email text NOT NULL DEFAULT 'noreply@notify.barbex.shop',
    domain text NOT NULL DEFAULT 'notify.barbex.shop',
    is_domain_verified boolean DEFAULT false,
    last_test_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'resend_settings_single_row') THEN
        CREATE UNIQUE INDEX resend_settings_single_row ON public.resend_settings ((id IS NOT NULL));
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.resend_settings TO authenticated;
GRANT ALL ON public.resend_settings TO service_role;

ALTER TABLE public.resend_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super Admins can manage Resend settings') THEN
        CREATE POLICY "Super Admins can manage Resend settings"
        ON public.resend_settings
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'super_admin'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read Resend settings') THEN
        CREATE POLICY "Authenticated users can read Resend settings"
        ON public.resend_settings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;