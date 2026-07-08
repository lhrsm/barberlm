ALTER TABLE public.customer_credits ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS description TEXT;