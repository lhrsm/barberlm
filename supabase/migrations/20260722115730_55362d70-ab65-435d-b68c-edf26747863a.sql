
-- 1) Função central de acesso a módulo (plano + add-on) — fail-open em erro
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug     text;
  v_allowed       jsonb;
  v_bshop_plan_id uuid;
BEGIN
  IF _user_id IS NULL OR _module_key IS NULL THEN
    RETURN true;
  END IF;

  -- Super admin bypass
  BEGIN
    IF public.is_super_admin_user() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- se helper não existir/errar, seguimos
    NULL;
  END;

  -- Add-on ativo em sandbox ou live
  BEGIN
    IF public.has_active_addon(_user_id, _module_key, 'sandbox')
       OR public.has_active_addon(_user_id, _module_key, 'live') THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Plano via profiles.effective_plan / profiles.plan
  SELECT lower(coalesce(p.effective_plan, p.plan))
    INTO v_plan_slug
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF v_plan_slug IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed FROM public.plans WHERE slug = v_plan_slug;
    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback via barbershops.plan_id
  SELECT plan_id INTO v_bshop_plan_id
    FROM public.barbershops
   WHERE id = _user_id
   LIMIT 1;

  IF v_bshop_plan_id IS NOT NULL THEN
    SELECT allowed_modules INTO v_allowed FROM public.plans WHERE id = v_bshop_plan_id;
    IF v_allowed IS NOT NULL AND v_allowed ? _module_key THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Fail-open: nunca bloquear mutação por erro inesperado de lookup
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.has_module_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, service_role;

-- 2) Policies RESTRICTIVE de escrita por (tabela, módulo)
DO $mig$
DECLARE
  r RECORD;
  pol_ins text;
  pol_upd text;
  pol_del text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('cashback_transactions','cashback'),
      ('barber_commissions','commissions'),
      ('commission_entries','commissions'),
      ('commission_closings','commissions'),
      ('products','products'),
      ('product_images','products'),
      ('product_sales','store'),
      ('subscription_plans','subscriptions'),
      ('subscription_plan_services','subscriptions'),
      ('subscription_plan_benefits','subscriptions'),
      ('subscription_plan_benefit_services','subscriptions'),
      ('customer_subscriptions','subscriptions'),
      ('subscription_payments','subscriptions'),
      ('loyalty_campaigns','loyalty'),
      ('loyalty_rewards','loyalty'),
      ('loyalty_settings','loyalty'),
      ('loyalty_campaign_templates','loyalty'),
      ('loyalty_campaign_participations','loyalty')
    ) AS t(tbl, mod)
  LOOP
    pol_ins := 'require_module_' || r.mod || '_insert';
    pol_upd := 'require_module_' || r.mod || '_update';
    pol_del := 'require_module_' || r.mod || '_delete';

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_ins, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_upd, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_del, r.tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), %L))',
      pol_ins, r.tbl, r.mod
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), %L)) WITH CHECK (public.has_module_access(auth.uid(), %L))',
      pol_upd, r.tbl, r.mod, r.mod
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), %L))',
      pol_del, r.tbl, r.mod
    );
  END LOOP;
END
$mig$;
