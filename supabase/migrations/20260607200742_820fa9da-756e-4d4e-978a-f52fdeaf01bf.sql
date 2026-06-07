CREATE TABLE IF NOT EXISTS public.appointment_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    group_token TEXT UNIQUE NOT NULL,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_groups TO authenticated;
GRANT ALL ON public.appointment_groups TO service_role;
GRANT SELECT ON public.appointment_groups TO anon;

ALTER TABLE public.appointment_groups ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant can manage their appointment groups') THEN
        CREATE POLICY "Tenant can manage their appointment groups" ON public.appointment_groups
            FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view appointment groups by token') THEN
        CREATE POLICY "Public can view appointment groups by token" ON public.appointment_groups
            FOR SELECT USING (true);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='service_amount') THEN
        ALTER TABLE public.appointments ADD COLUMN service_amount NUMERIC(10, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='group_sequence') THEN
        ALTER TABLE public.appointments ADD COLUMN group_sequence INTEGER;
    END IF;
END $$;

-- Function to fetch group appointments safely
CREATE OR REPLACE FUNCTION public.get_appointment_group_by_token(p_token TEXT)
RETURNS TABLE (
    group_id UUID,
    tenant_id UUID,
    customer_id UUID,
    customer_name TEXT,
    business_name TEXT,
    total_amount NUMERIC,
    payment_status TEXT,
    group_status TEXT,
    appointment_id UUID,
    service_id UUID,
    service_name TEXT,
    professional_id UUID,
    professional_name TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    appointment_status TEXT,
    service_amount NUMERIC,
    group_sequence INTEGER,
    management_token TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ag.id as group_id,
        ag.tenant_id,
        ag.customer_id,
        c.name as customer_name,
        p.business_name,
        ag.total_amount,
        ag.payment_status,
        ag.status as group_status,
        a.id as appointment_id,
        a.service_id,
        s.name as service_name,
        a.barber_id as professional_id,
        b.name as professional_name,
        a.start_time,
        a.end_time,
        a.status as appointment_status,
        a.service_amount,
        a.group_sequence,
        a.management_token
    FROM public.appointment_groups ag
    JOIN public.appointments a ON a.appointment_group_id = ag.id
    LEFT JOIN public.customers c ON ag.customer_id = c.id
    LEFT JOIN public.profiles p ON ag.tenant_id = p.id
    LEFT JOIN public.services s ON a.service_id = s.id
    LEFT JOIN public.barbers b ON a.barber_id = b.id
    WHERE ag.group_token = p_token
    ORDER BY a.group_sequence ASC;
END;
$$;
