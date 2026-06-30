
-- Add dedicated avatar_url column for the administrator photo (separate from barbershop logo)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill: legacy "logo_url" stored the barbershop logo. If barbershop_logo_url is empty,
-- migrate the value from logo_url so the Geral tab shows the existing logo again.
UPDATE public.profiles
SET barbershop_logo_url = logo_url
WHERE (barbershop_logo_url IS NULL OR barbershop_logo_url = '')
  AND logo_url IS NOT NULL
  AND logo_url <> '';
