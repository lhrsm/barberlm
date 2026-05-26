-- Notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);
UPDATE public.notifications SET tenant_id = user_id WHERE tenant_id IS NULL AND user_id IS NOT NULL;

-- Transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
UPDATE public.transactions SET tenant_id = user_id WHERE tenant_id IS NULL AND user_id IS NOT NULL;

-- Enable RLS and add policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own tenant data' AND tablename = 'notifications') THEN
        CREATE POLICY "Users can view their own tenant data" ON public.notifications
            FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own tenant data' AND tablename = 'transactions') THEN
        CREATE POLICY "Users can view their own tenant data" ON public.transactions
            FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;
