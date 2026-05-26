-- Add appointment_group_id column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_group_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_appointments_group_id ON public.appointments(appointment_group_id);

-- Explicitly grant permissions just in case
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT ALL ON public.appointments TO anon;
