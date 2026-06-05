-- Add columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_card_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS debit_card_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_breakdown JSONB;

-- Add columns to transactions table if they don't exist
-- Some might already exist based on previous code view, but let's ensure consistency
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_card_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS debit_card_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_breakdown JSONB;

-- Note: appointment_id, user_id, etc. already have foreign keys and RLS.
-- Existing RLS policies on appointments and transactions will cover these new columns.
