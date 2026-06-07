-- Create refund_audits table
CREATE TABLE IF NOT EXISTS public.refund_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id UUID NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id),
    changed_by_id UUID, -- References auth.users or profiles
    changed_by_type TEXT NOT NULL CHECK (changed_by_type IN ('admin', 'system')),
    old_status TEXT,
    new_status TEXT NOT NULL,
    changes JSONB, -- Stores which fields were modified
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for refund_audits
ALTER TABLE public.refund_audits ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON public.refund_audits TO authenticated;
GRANT ALL ON public.refund_audits TO service_role;

-- Policies for refund_audits
CREATE POLICY "Admins can view their own tenant's refund audits" 
ON public.refund_audits FOR SELECT 
USING (auth.uid() = tenant_id);

-- Ensure refund_requests has proper uniqueness to prevent duplicates
-- Assuming payment_id or appointment_id should be unique for successful refunds
-- But a request might be rejected and a new one created, so we check for non-rejected/cancelled ones
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_single_active_per_appointment 
ON public.refund_requests (appointment_id) 
WHERE (status NOT IN ('rejected', 'cancelled'));

-- Function to handle refund audit logging
CREATE OR REPLACE FUNCTION public.log_refund_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_changes JSONB := '{}'::jsonb;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
            
            INSERT INTO public.refund_audits (
                refund_id,
                tenant_id,
                changed_by_id,
                changed_by_type,
                old_status,
                new_status,
                changes
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                auth.uid(), -- Might be null if system-driven
                CASE WHEN auth.uid() IS NOT NULL THEN 'admin' ELSE 'system' END,
                OLD.status,
                NEW.status,
                v_changes
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.refund_audits (
            refund_id,
            tenant_id,
            changed_by_id,
            changed_by_type,
            old_status,
            new_status,
            changes
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            auth.uid(),
            CASE WHEN auth.uid() IS NOT NULL THEN 'admin' ELSE 'system' END,
            NULL,
            NEW.status,
            jsonb_build_object('initial_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for refund_requests
DROP TRIGGER IF EXISTS tr_log_refund_status_change ON public.refund_requests;
CREATE TRIGGER tr_log_refund_status_change
AFTER INSERT OR UPDATE ON public.refund_requests
FOR EACH ROW EXECUTE FUNCTION public.log_refund_status_change();
