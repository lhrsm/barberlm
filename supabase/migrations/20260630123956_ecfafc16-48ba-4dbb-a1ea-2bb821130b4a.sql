
-- 1) One-time backfill: copy onboarding data from barbershops -> profiles when missing
UPDATE public.profiles p
SET
  business_name = COALESCE(NULLIF(p.business_name, ''), b.name),
  slug = COALESCE(NULLIF(p.slug, ''), NULLIF(b.slug, p.id::text)),
  barbershop_logo_url = COALESCE(p.barbershop_logo_url, b.logo_url)
FROM public.barbershops b
WHERE b.owner_id = p.id
  AND (
    COALESCE(p.business_name, '') = ''
    OR COALESCE(p.slug, '') = ''
    OR p.barbershop_logo_url IS NULL
  );

-- 2) Trigger to keep them in sync going forward
CREATE OR REPLACE FUNCTION public.sync_barbershop_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET
    business_name = COALESCE(NULLIF(p.business_name, ''), NEW.name),
    slug = COALESCE(NULLIF(p.slug, ''), NULLIF(NEW.slug, p.id::text)),
    barbershop_logo_url = COALESCE(p.barbershop_logo_url, NEW.logo_url),
    updated_at = now()
  WHERE p.id = NEW.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barbershop_to_profile ON public.barbershops;
CREATE TRIGGER trg_sync_barbershop_to_profile
AFTER INSERT OR UPDATE ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.sync_barbershop_to_profile();
