SELECT 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'auth_user_id') as has_column,
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'claim_customer_profile') as has_function,
    (SELECT COUNT(*) FROM pg_policies WHERE policyname IN ('Customers can view own profile', 'Customers can view own appointments')) as has_policies;
