-- Add birth_date column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date DATE;