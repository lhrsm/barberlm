-- Ensure tenant_id exists in profiles and it points to itself if it's the root profile
-- (Assuming profiles.id is used as the tenant identifier)

-- Appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id);

-- Customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);

-- Barbers
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_barbers_tenant_id ON public.barbers(tenant_id);

-- Services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON public.services(tenant_id);

-- WhatsApp Connections
ALTER TABLE public.whatsapp_connections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_tenant_id ON public.whatsapp_connections(tenant_id);

-- WhatsApp Instances
-- whatsapp_instances already has tenant_id but let's ensure it has the FK
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'whatsapp_instances_tenant_id_fkey') THEN
        ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- Automation Logs
-- Ensure the table exists with the correct structure
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.profiles(id),
    automation_id UUID REFERENCES public.automations(id),
    customer_id UUID REFERENCES public.customers(id),
    appointment_id UUID REFERENCES public.appointments(id),
    barber_id UUID REFERENCES public.barbers(id),
    message_type TEXT,
    phone TEXT,
    original_template TEXT,
    processed_template TEXT,
    status TEXT,
    error_message TEXT,
    response JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Automations
-- Ensure automations has the FK if not already there
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'automations_tenant_id_fkey') THEN
        ALTER TABLE public.automations ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- Enable RLS for all these tables
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Simplified for now, assuming auth.uid() is used)
-- Note: A more complex policy might be needed to check if the user belongs to the tenant
-- But usually, in this kind of app, one user = one barbearia, or we check profile mapping.

-- For now, let's create policies that allow access if tenant_id matches the user's profile ID
-- or if the user is an admin.

CREATE POLICY "Users can view their own tenant data" ON public.appointments
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.customers
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.barbers
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.services
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.automations
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.automation_logs
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.whatsapp_connections
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own tenant data" ON public.whatsapp_instances
    FOR ALL USING (tenant_id = (SELECT id FROM public.profiles WHERE id = auth.uid()));
