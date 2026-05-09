-- Add cashback fields to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cashback_used NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_earned NUMERIC DEFAULT 0;

-- Ensure customers has cashback_balance (it might already exist based on types.ts but safe to ensure)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='cashback_balance') THEN
    ALTER TABLE public.customers ADD COLUMN cashback_balance NUMERIC DEFAULT 0;
  END IF;
END $$;
