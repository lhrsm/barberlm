
-- 1. Atualizar allowed_modules e limits dos 3 planos oficiais
UPDATE public.plans SET
  allowed_modules = '["dashboard","calendar","customers","barbers","services","client_portal","barber_panel","basic_finance","finances","reports_basic","whatsapp","automations_basic","support","portal"]'::jsonb,
  limits = jsonb_build_object('barbers',3,'clients',300,'services',15,'admins',1,'automations',3),
  automation_limit = 3
WHERE slug = 'starter';

UPDATE public.plans SET
  allowed_modules = '["dashboard","calendar","customers","barbers","services","client_portal","barber_panel","basic_finance","advanced_finance","finances","reports_basic","reports_advanced","dashboard_advanced","whatsapp","automations_basic","automations_smart","support","portal","stock","coupons","cashback","loyalty","products","store","subscriptions","subscription_rewards","payment_gateway","commissions","campaigns"]'::jsonb,
  limits = jsonb_build_object('barbers',10,'clients',null,'services',null,'admins',3,'automations',8),
  automation_limit = 8
WHERE slug = 'pro';

UPDATE public.plans SET
  allowed_modules = '["dashboard","calendar","customers","barbers","services","client_portal","barber_panel","basic_finance","advanced_finance","finances","reports_basic","reports_advanced","dashboard_advanced","whatsapp","automations_basic","automations_smart","automations_unlimited","support","portal","stock","coupons","cashback","loyalty","products","store","subscriptions","subscription_rewards","payment_gateway","commissions","campaigns","ai","api","api_access","integrations","white_label","multi_units","corporate_reports","tutorials","pix_key","ai_scheduler","ai_commercial","ai_recovery","ai_products","ai_subscriptions","ai_smart_replies","ai_campaigns","ai_loyalty","ai_whatsapp","ai_google_reviews","ai_upsell","ai_cross_sell","automations"]'::jsonb,
  limits = jsonb_build_object('barbers',null,'clients',null,'services',null,'admins',null,'automations',null),
  automation_limit = -1
WHERE slug = 'elite';

-- 2. Aprimorar trigger de sync para também desabilitar módulos removidos do plano (downgrade)
CREATE OR REPLACE FUNCTION public.sync_modules_for_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mod text;
  allowed jsonb;
  default_enabled boolean;
  plan_slug text;
BEGIN
  IF NEW.plan_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.allowed_modules, p.slug INTO allowed, plan_slug
  FROM public.plans p WHERE p.id = NEW.plan_id;

  IF allowed IS NULL THEN RETURN NEW; END IF;

  -- Inserir módulos novos (que vieram com o plano)
  FOR mod IN SELECT jsonb_array_elements_text(allowed) LOOP
    default_enabled := CASE
      WHEN plan_slug = 'starter' THEN true
      WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','basic_finance','support','commissions','loyalty','coupons','whatsapp','client_portal','barber_panel','reports_basic','automations_basic') THEN true
      ELSE false
    END;
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
    VALUES (NEW.id, mod, default_enabled)
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END LOOP;

  -- Desativar módulos que NÃO pertencem mais ao plano (downgrade)
  UPDATE public.barbershop_modules
     SET enabled = false
   WHERE tenant_id = NEW.id
     AND NOT (allowed ? module_key);

  RETURN NEW;
END;
$$;

-- 3. Função utilitária pública: ressincronizar uma barbearia (chamável após upgrade via checkout)
CREATE OR REPLACE FUNCTION public.sync_barbershop_modules(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mod text;
  allowed jsonb;
  default_enabled boolean;
  plan_slug text;
  resolved_plan_id uuid;
BEGIN
  -- 1) tenta plan_id em barbershops
  SELECT plan_id INTO resolved_plan_id FROM public.barbershops WHERE id = p_tenant_id;

  -- 2) fallback: resolve via profiles.effective_plan/plan
  IF resolved_plan_id IS NULL THEN
    SELECT p.id INTO resolved_plan_id
      FROM public.profiles pr
      JOIN public.plans p
        ON p.slug = lower(coalesce(nullif(pr.effective_plan,''), nullif(pr.plan,''), 'starter'))
     WHERE pr.id = p_tenant_id;
  END IF;

  IF resolved_plan_id IS NULL THEN RETURN; END IF;

  SELECT p.allowed_modules, p.slug INTO allowed, plan_slug
    FROM public.plans p WHERE p.id = resolved_plan_id;
  IF allowed IS NULL THEN RETURN; END IF;

  FOR mod IN SELECT jsonb_array_elements_text(allowed) LOOP
    default_enabled := CASE
      WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','basic_finance','support','whatsapp','client_portal','barber_panel','reports_basic') THEN true
      ELSE false
    END;
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
    VALUES (p_tenant_id, mod, default_enabled)
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END LOOP;

  UPDATE public.barbershop_modules
     SET enabled = false
   WHERE tenant_id = p_tenant_id
     AND NOT (allowed ? module_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_barbershop_modules(uuid) TO authenticated, service_role;

-- 4. Trigger em profiles: ao trocar plano (effective_plan), ressincroniza módulos
CREATE OR REPLACE FUNCTION public.tg_sync_modules_on_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (coalesce(NEW.effective_plan,'') IS DISTINCT FROM coalesce(OLD.effective_plan,''))
     OR (coalesce(NEW.plan,'') IS DISTINCT FROM coalesce(OLD.plan,'')) THEN
    PERFORM public.sync_barbershop_modules(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_modules_on_profile_plan ON public.profiles;
CREATE TRIGGER trg_sync_modules_on_profile_plan
AFTER UPDATE OF plan, effective_plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_modules_on_profile_plan_change();
