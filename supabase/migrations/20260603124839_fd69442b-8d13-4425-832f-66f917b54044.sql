-- AUDIT SYNCHRONIZATION MIGRATION

-- 1. Table: customers
-- Adding missing analytical and balance columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='credit_balance') THEN
        ALTER TABLE public.customers ADD COLUMN credit_balance DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='total_spent') THEN
        ALTER TABLE public.customers ADD COLUMN total_spent DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='lifetime_value') THEN
        ALTER TABLE public.customers ADD COLUMN lifetime_value DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='last_visit') THEN
        ALTER TABLE public.customers ADD COLUMN last_visit TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Table: appointments
-- Adding plural alias for credits tracking to avoid SQL errors in some logic variants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='credits_used') THEN
        ALTER TABLE public.appointments ADD COLUMN credits_used DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;

-- 3. Table: automation_queue
-- Adding missing updated_at column used in the automation engine
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_queue' AND column_name='updated_at') THEN
        ALTER TABLE public.automation_queue ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 4. Table: conversation_sessions
-- Adding active flag used in the session state management
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_sessions' AND column_name='active') THEN
        ALTER TABLE public.conversation_sessions ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 5. Synchronize balances if needed (safe best-effort)
-- If credit_balance was added, we sync it with credits if credits already had data
UPDATE public.customers 
SET credit_balance = COALESCE(credits, 0) 
WHERE credit_balance = 0 AND credits > 0;

-- If credits_used was added, we sync it with credit_used
UPDATE public.appointments 
SET credits_used = COALESCE(credit_used, 0) 
WHERE credits_used = 0 AND credit_used > 0;

-- GRANT permissions for safety
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT ON public.customers TO anon;
GRANT SELECT ON public.barbers TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT ON public.appointments TO anon;
