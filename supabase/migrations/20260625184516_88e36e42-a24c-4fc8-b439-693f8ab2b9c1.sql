
-- 1) Add automation_limit column if not exists
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS automation_limit INTEGER DEFAULT 0;

-- 2) Clean legacy rows (empty-slug "Pro" and Enterprise)
DELETE FROM public.plans WHERE slug IS NULL OR slug = '';

-- 3) Migrate existing tenants on legacy plans BEFORE removing
UPDATE public.profiles SET plan = 'pro' WHERE LOWER(plan) IN ('professional','pro');
UPDATE public.profiles SET effective_plan = 'pro' WHERE LOWER(effective_plan) IN ('professional','pro');
UPDATE public.profiles SET selected_plan = 'pro' WHERE LOWER(selected_plan) IN ('professional','pro');
UPDATE public.profiles SET plan = 'elite' WHERE LOWER(plan) = 'enterprise';
UPDATE public.profiles SET effective_plan = 'elite' WHERE LOWER(effective_plan) = 'enterprise';
UPDATE public.profiles SET selected_plan = 'elite' WHERE LOWER(selected_plan) = 'enterprise';

-- 4) Remove Enterprise plan
DELETE FROM public.plans WHERE slug = 'enterprise';

-- 5) Rename professional -> pro (delete old pro if exists, then update)
DELETE FROM public.plans WHERE slug = 'pro';
UPDATE public.plans
SET slug = 'pro',
    name = 'Pro',
    tier = 2,
    price_monthly = 99.90,
    automation_limit = 8,
    allowed_modules = '["dashboard","calendar","customers","barbers","services","finances","support","portal","whatsapp","reports_basic","products","coupons","cashback","loyalty","subscriptions","payment_gateway","commissions","campaigns","store","dashboard_advanced","reports_advanced"]'::jsonb,
    features = '{"agenda":true,"reports":"avancado","cashback":true,"whatsapp":true,"financeiro":"completo","automations":true,"badge":"MAIS_VENDIDO","support":"prioritario"}'::jsonb,
    limits = '{"max_barbers":10,"max_customers":-1,"max_services":-1,"max_admins":3,"automations":8}'::jsonb
WHERE slug = 'professional';

-- 6) Update Starter
UPDATE public.plans
SET name = 'Starter',
    tier = 1,
    price_monthly = 59.90,
    automation_limit = 3,
    allowed_modules = '["dashboard","calendar","customers","barbers","services","finances","support","portal","whatsapp","reports_basic"]'::jsonb,
    features = '{"agenda":true,"clientes":300,"whatsapp":true,"financeiro":"basico","automations":3,"support":"padrao"}'::jsonb,
    limits = '{"max_barbers":3,"max_customers":300,"max_services":15,"max_admins":1,"automations":3}'::jsonb
WHERE slug = 'starter';

-- 7) Update Elite (all modules + IA)
UPDATE public.plans
SET name = 'Elite',
    tier = 3,
    price_monthly = 149.90,
    automation_limit = -1,
    allowed_modules = '["dashboard","calendar","customers","barbers","services","finances","support","portal","whatsapp","reports_basic","products","coupons","cashback","loyalty","subscriptions","payment_gateway","commissions","campaigns","store","dashboard_advanced","reports_advanced","ai_scheduler","ai_commercial","ai_recovery","ai_products","ai_subscriptions","ai_smart_replies","ai_campaigns","ai_loyalty","ai_whatsapp","ai_google_reviews","ai_upsell","ai_cross_sell","api_access","integrations","white_label","multi_units","automations","tutorials","pix_key","subscription_rewards","corporate_reports"]'::jsonb,
    features = '{"ia":true,"agenda":true,"reports":"premium","support":"maxima","cashback":true,"whatsapp":true,"analytics":true,"financeiro":"premium","automations":"unlimited","api":true,"white_label":true}'::jsonb,
    limits = '{"max_barbers":-1,"max_customers":-1,"max_services":-1,"max_admins":-1,"automations":-1}'::jsonb
WHERE slug = 'elite';
