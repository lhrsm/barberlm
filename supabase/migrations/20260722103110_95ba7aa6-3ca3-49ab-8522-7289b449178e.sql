
ALTER TABLE public.saas_addons
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenant_addons
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false;

UPDATE public.saas_addons
SET trial_days = 7, is_premium = true
WHERE addon_key IN ('ai_assistant','advanced_analytics','cashback');
