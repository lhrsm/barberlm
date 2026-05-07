-- Add time column to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS time TIME;

-- Try to populate time from created_at for existing rows
UPDATE public.transactions 
SET time = created_at::time 
WHERE time IS NULL;

-- Try to sync date/time from appointments if available
-- Note: start_time is a timestamp with time zone, we cast to date and time
UPDATE public.transactions t
SET 
  date = a.start_time::date,
  time = a.start_time::time
FROM public.appointments a
WHERE t.appointment_id = a.id AND t.appointment_id IS NOT NULL;