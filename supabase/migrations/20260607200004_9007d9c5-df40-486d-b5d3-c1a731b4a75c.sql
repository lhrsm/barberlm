-- 1. Create WhatsApp Delivery Logs table for detailed auditing
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id),
    dispatch_id UUID REFERENCES public.automation_v2_dispatches(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'read', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    payload JSONB,
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_delivery_logs TO authenticated;
GRANT ALL ON public.whatsapp_delivery_logs TO service_role;

-- Enable RLS
ALTER TABLE public.whatsapp_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own delivery logs" ON public.whatsapp_delivery_logs
    FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);

-- 2. Enhance automation_v2_dispatches with retry info
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_v2_dispatches' AND column_name = 'retry_count') THEN
        ALTER TABLE public.automation_v2_dispatches ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_v2_dispatches' AND column_name = 'last_retry_at') THEN
        ALTER TABLE public.automation_v2_dispatches ADD COLUMN last_retry_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_v2_dispatches' AND column_name = 'error_log') THEN
        ALTER TABLE public.automation_v2_dispatches ADD COLUMN error_log JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Add missing columns to refund_requests
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'payment_id') THEN
        ALTER TABLE public.refund_requests ADD COLUMN payment_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'refund_method') THEN
        ALTER TABLE public.refund_requests ADD COLUMN refund_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'admin_notes') THEN
        ALTER TABLE public.refund_requests ADD COLUMN admin_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'completed_at') THEN
        ALTER TABLE public.refund_requests ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 4. Enhance refund_requests for better filtering
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON public.refund_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_refund_requests_appointment_id ON public.refund_requests(appointment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_tenant_id ON public.refund_requests(tenant_id);

-- 5. Audit trigger for updated_at on whatsapp_delivery_logs
CREATE OR REPLACE FUNCTION public.update_whatsapp_delivery_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_delivery_logs_updated_at_trigger
    BEFORE UPDATE ON public.whatsapp_delivery_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_delivery_logs_updated_at();