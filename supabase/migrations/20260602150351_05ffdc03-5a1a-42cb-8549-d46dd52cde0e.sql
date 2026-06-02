-- Add missing columns to automation_cron_runs for better tracking
ALTER TABLE public.automation_cron_runs 
ADD COLUMN IF NOT EXISTS found_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS eligible_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_appointments JSONB DEFAULT '[]'::jsonb;

-- Create a view for easy debugging of automation status if needed
CREATE OR REPLACE VIEW public.vw_automation_debug AS
SELECT 
    a.id as appointment_id,
    a.status,
    a.created_at,
    a.start_time,
    a.confirmation_sent_at,
    a.confirmation_sent,
    c.name as customer_name,
    c.phone as customer_phone,
    a.tenant_id
FROM public.appointments a
LEFT JOIN public.customers c ON a.customer_id = c.id;

-- Grant permissions
GRANT SELECT ON public.vw_automation_debug TO authenticated;
GRANT SELECT ON public.vw_automation_debug TO service_role;
