CREATE TABLE IF NOT EXISTS public.system_health_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slack_webhook_url TEXT,
    alert_emails TEXT[],
    deduplication_minutes INTEGER DEFAULT 60,
    notify_on_critical_error BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_health_settings TO service_role;
GRANT SELECT ON public.system_health_settings TO authenticated;

-- Ensure there is at least one row
INSERT INTO public.system_health_settings (id) 
SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM public.system_health_settings);

-- Add deduplication column to templates
ALTER TABLE public.automation_templates ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE;
