
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS tier int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_barbers int,
  ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;

-- Upsert by name (existing unique constraint)
INSERT INTO public.plans (name, slug, description, price_monthly, price_yearly, tier, max_barbers, is_recommended, allowed_modules, features, limits, active)
VALUES
  ('Starter','starter','Para barbearias iniciantes',49.90,499.00,1,3,false,
    '["dashboard","calendar","customers","barbers","services","finances","support"]'::jsonb,
    '{}'::jsonb,'{"max_barbers":3}'::jsonb,true),
  ('Professional','professional','Plano recomendado para barbearias em crescimento',99.90,999.00,2,10,true,
    '["dashboard","calendar","customers","barbers","services","finances","support","commissions","loyalty","campaigns","coupons","whatsapp"]'::jsonb,
    '{}'::jsonb,'{"max_barbers":10}'::jsonb,true),
  ('Elite','elite','Plano premium com todos os recursos de crescimento',149.90,1499.00,3,NULL,false,
    '["dashboard","calendar","customers","barbers","services","finances","support","commissions","loyalty","campaigns","coupons","whatsapp","subscriptions","cashback","products","automations","subscription_rewards","integrations","tutorials","pix_key"]'::jsonb,
    '{}'::jsonb,'{}'::jsonb,true),
  ('Enterprise','enterprise','Para redes de barbearias',249.90,2499.00,4,NULL,false,
    '["dashboard","calendar","customers","barbers","services","finances","support","commissions","loyalty","campaigns","coupons","whatsapp","subscriptions","cashback","products","automations","subscription_rewards","integrations","tutorials","pix_key","multi_units","white_label","api_access","corporate_reports"]'::jsonb,
    '{}'::jsonb,'{}'::jsonb,true)
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  tier = EXCLUDED.tier,
  max_barbers = EXCLUDED.max_barbers,
  is_recommended = EXCLUDED.is_recommended,
  allowed_modules = EXCLUDED.allowed_modules,
  limits = EXCLUDED.limits,
  active = EXCLUDED.active;

CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_key ON public.plans(slug);

ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

UPDATE public.barbershops
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'starter')
WHERE plan_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_allowed_modules(_tenant uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.allowed_modules, '[]'::jsonb)
  FROM public.barbershops b
  LEFT JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = _tenant;
$$;

GRANT EXECUTE ON FUNCTION public.get_allowed_modules(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.sync_modules_for_plan()
RETURNS TRIGGER
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

  FOR mod IN SELECT jsonb_array_elements_text(allowed) LOOP
    default_enabled := CASE
      WHEN plan_slug = 'starter' THEN true
      WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','support','commissions','loyalty','coupons','whatsapp') THEN true
      ELSE false
    END;
    INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
    VALUES (NEW.id, mod, default_enabled)
    ON CONFLICT (tenant_id, module_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_modules_for_plan ON public.barbershops;
CREATE TRIGGER trg_sync_modules_for_plan
AFTER INSERT OR UPDATE OF plan_id ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.sync_modules_for_plan();

-- Backfill modules for existing barbershops
INSERT INTO public.barbershop_modules (tenant_id, module_key, enabled)
SELECT b.id, mod,
  CASE WHEN p.slug = 'starter' THEN true
       WHEN mod IN ('dashboard','calendar','customers','barbers','services','finances','support','commissions','loyalty','coupons','whatsapp') THEN true
       ELSE false END
FROM public.barbershops b
JOIN public.plans p ON p.id = b.plan_id,
LATERAL jsonb_array_elements_text(p.allowed_modules) AS mod
ON CONFLICT (tenant_id, module_key) DO NOTHING;
