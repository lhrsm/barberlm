-- Add columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT false;

-- Add column to customers for birthday
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS birthday_sent BOOLEAN DEFAULT false;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent ON public.appointments(reminder_sent);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_sent ON public.appointments(confirmation_sent);
CREATE INDEX IF NOT EXISTS idx_customers_birthday_sent ON public.customers(birthday_sent);
