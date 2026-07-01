-- Backfill business logo from barbershops table into profiles for tenants where profile fields are missing.
-- This ensures /settings can display the previously-saved barbershop logo without losing data.

UPDATE public.profiles p
SET
  barbershop_logo_url = COALESCE(NULLIF(p.barbershop_logo_url, ''), b.logo_url),
  logo_url            = COALESCE(NULLIF(p.logo_url, ''),            b.logo_url),
  business_name       = COALESCE(NULLIF(p.business_name, ''),       b.name),
  slug                = COALESCE(NULLIF(p.slug, ''),                NULLIF(b.slug, p.id::text)),
  updated_at          = now()
FROM public.barbershops b
WHERE b.owner_id = p.id
  AND (
       (COALESCE(p.barbershop_logo_url, '') = '' AND b.logo_url IS NOT NULL)
    OR (COALESCE(p.logo_url, '')            = '' AND b.logo_url IS NOT NULL)
    OR (COALESCE(p.business_name, '')       = '' AND b.name     IS NOT NULL)
  );

-- Strengthen sync trigger: when barbershops.logo_url gets a fresh value, propagate to profile
-- even if profile already had one (source of truth = barbershops when non-empty).
CREATE OR REPLACE FUNCTION public.sync_barbershop_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles p
  SET
    business_name       = COALESCE(NULLIF(p.business_name, ''), NEW.name),
    slug                = COALESCE(NULLIF(p.slug, ''),           NULLIF(NEW.slug, p.id::text)),
    barbershop_logo_url = COALESCE(NULLIF(NEW.logo_url, ''),     p.barbershop_logo_url),
    logo_url            = COALESCE(NULLIF(NEW.logo_url, ''),     p.logo_url),
    updated_at          = now()
  WHERE p.id = NEW.owner_id;
  RETURN NEW;
END;
$function$;