-- Add foreign key to subscriptions to allow PostgREST joins with profiles
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey,
ADD CONSTRAINT subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Ensure system_settings has at least one row if it doesn't already
INSERT INTO public.system_settings (id, saas_name, main_url)
SELECT gen_random_uuid(), 'Barbex', 'https://barbex.shop'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings)
ON CONFLICT DO NOTHING;

-- Refresh the view/cache for the super admin permissions just in case
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Ensure policies are correctly set for super_admin
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can manage subscriptions') THEN
        CREATE POLICY "Super admins can manage subscriptions" 
        ON public.subscriptions FOR ALL 
        USING (public.is_super_admin_user());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can manage system settings') THEN
        CREATE POLICY "Super admins can manage system settings" 
        ON public.system_settings FOR ALL 
        USING (public.is_super_admin_user());
    END IF;
END $$;
