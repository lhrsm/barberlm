-- Fase 4: integração do voucher administrativo com o guard de módulos
-- e helper para exclusão de barbearias de teste das métricas comerciais.

-- 1) has_module_access: se o tenant tem voucher administrativo ativo,
-- concede acesso a QUALQUER módulo.
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
    NULL;
  END;

  -- Voucher administrativo ativo → libera todos os módulos
  BEGIN
    IF public.has_active_internal_voucher(_user_id) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
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
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.has_module_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, service_role;

-- 2) Helper para filtrar tenants de teste em métricas comerciais.
CREATE OR REPLACE FUNCTION public.is_internal_test_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_internal_test_tenant FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_internal_test_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_test_tenant(uuid) TO authenticated, service_role;