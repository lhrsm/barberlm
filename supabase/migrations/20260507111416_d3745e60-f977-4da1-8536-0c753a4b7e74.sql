ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Update existing records to 'paid' if they were created before this change (assuming they were completed)
UPDATE public.appointments SET payment_status = 'paid' WHERE status = 'completed';