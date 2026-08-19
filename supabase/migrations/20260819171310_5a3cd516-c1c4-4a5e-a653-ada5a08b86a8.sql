-- 1. Ensure auth_user_id exists on customers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.customers ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Create unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_auth_user 
ON public.customers (tenant_id, auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- 3. Support indexes
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON public.appointments(customer_id);

-- 4. Replace claim_customer_profile with hardened version
-- First drop to change return type from SETOF/void/something else to JSONB
DROP FUNCTION IF EXISTS public.claim_customer_profile(UUID);

CREATE OR REPLACE FUNCTION public.claim_customer_profile(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_customer_id UUID;
    v_phone TEXT;
    v_email_confirmed BOOLEAN;
BEGIN
    -- Get current user ID
    v_user_id := (SELECT auth.uid());
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate user
    SELECT (email_confirmed_at IS NOT NULL), phone
    INTO v_email_confirmed, v_phone
    FROM auth.users
    WHERE id = v_user_id;

    -- Find customer by phone in the specific tenant
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE tenant_id = p_tenant_id
      AND (
          phone = v_phone 
          OR phone = REPLACE(REPLACE(REPLACE(REPLACE(v_phone, ' ', ''), '-', ''), '(', ''), ')', '')
      )
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Customer profile not found');
    END IF;

    -- Check if already claimed
    IF EXISTS (
        SELECT 1 FROM public.customers 
        WHERE id = v_customer_id AND auth_user_id IS NOT NULL AND auth_user_id != v_user_id
    ) THEN
        RAISE EXCEPTION 'Profile already linked to another account';
    END IF;

    -- Update
    UPDATE public.customers
    SET auth_user_id = v_user_id,
        updated_at = NOW()
    WHERE id = v_customer_id;

    RETURN jsonb_build_object(
        'success', true, 
        'customer_id', v_customer_id
    );
END;
$$;

-- 5. Permissions
REVOKE EXECUTE ON FUNCTION public.claim_customer_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_customer_profile(UUID) TO authenticated;

-- 6. Hardened RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_achievements ENABLE ROW LEVEL SECURITY;

-- Customers
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile"
ON public.customers FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()));

-- Appointments
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())));

-- Credit Transactions
DROP POLICY IF EXISTS "Customers can view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Customers can view own credit transactions"
ON public.credit_transactions FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())));

-- Cashback Transactions
DROP POLICY IF EXISTS "Customers can view own cashback transactions" ON public.cashback_transactions;
CREATE POLICY "Customers can view own cashback transactions"
ON public.cashback_transactions FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())));

-- Subscriptions
DROP POLICY IF EXISTS "Customers can view own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can view own subscriptions"
ON public.customer_subscriptions FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())));

-- Achievements
DROP POLICY IF EXISTS "Customers can read their own achievements" ON public.customer_achievements;
DROP POLICY IF EXISTS "Customers can view own achievements" ON public.customer_achievements;
CREATE POLICY "Customers can view own achievements"
ON public.customer_achievements FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())));
