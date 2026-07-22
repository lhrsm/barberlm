DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'subscription_invoices',
    'subscription_status_logs',
    'subscription_plan_changes',
    'subscription_usage_logs',
    'subscription_card_scans',
    'subscription_referrals',
    'subscription_loyalty_history',
    'subscription_loyalty_rewards'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS require_module_subscriptions_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS require_module_subscriptions_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS require_module_subscriptions_delete ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY require_module_subscriptions_insert ON public.%I
      AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (public.has_module_access(auth.uid(), 'subscriptions') OR public.is_super_admin_user())
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY require_module_subscriptions_update ON public.%I
      AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (public.has_module_access(auth.uid(), 'subscriptions') OR public.is_super_admin_user())
      WITH CHECK (public.has_module_access(auth.uid(), 'subscriptions') OR public.is_super_admin_user())
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY require_module_subscriptions_delete ON public.%I
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.has_module_access(auth.uid(), 'subscriptions') OR public.is_super_admin_user())
    $f$, t);
  END LOOP;
END $$;