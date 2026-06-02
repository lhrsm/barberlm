-- Add tracking columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Create automation cron runs log table
CREATE TABLE IF NOT EXISTS public.automation_cron_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL, -- 'running', 'success', 'error'
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,
    tenant_id UUID REFERENCES public.profiles(id),
    appointment_id UUID REFERENCES public.appointments(id)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.automation_cron_runs TO authenticated;
GRANT ALL ON public.automation_cron_runs TO service_role;

-- Enable RLS
ALTER TABLE public.automation_cron_runs ENABLE ROW LEVEL SECURITY;

-- Simple policy for viewing logs
CREATE POLICY "Users can view their own cron logs"
ON public.automation_cron_runs
FOR SELECT
USING (auth.uid() = tenant_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_sent_at ON public.appointments(confirmation_sent_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent_at ON public.appointments(reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_appointments_group_id ON public.appointments(appointment_group_id);
