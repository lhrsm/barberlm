-- BARBEX MULTI-TENANT REPAIR
-- Target: Fix handle_new_user to be role-aware and clean up erroneous client tenants.

-- 1. Correct the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  shop_name text;
  generated_slug text;
  user_role text;
  target_tenant_id uuid;
BEGIN
  -- Determine role from metadata or default to tenant_admin
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant_admin');
  
  -- Logic for administrative roles (Barbershop Owners)
  IF user_role IN ('tenant_admin', 'admin', 'super_admin') THEN
    shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
    generated_slug := generate_unique_slug(shop_name);

    INSERT INTO public.profiles (
      id, business_name, responsible_name, email, whatsapp_number,
      barbers_range, plan, trial_end, role, status, slug
    )
    VALUES (
      new.id, shop_name, new.raw_user_meta_data->>'responsible_name',
      new.email, new.raw_user_meta_data->>'whatsapp_number',
      new.raw_user_meta_data->>'barbers_range',
      COALESCE(new.raw_user_meta_data->>'plan', 'pro'),
      CASE 
        WHEN (new.raw_user_meta_data->>'plan') = 'pro' OR new.raw_user_meta_data->>'plan' IS NULL 
        THEN (now() + interval '15 days') 
        ELSE NULL 
      END,
      user_role, 'active', generated_slug
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      responsible_name = EXCLUDED.responsible_name,
      email = EXCLUDED.email,
      slug = COALESCE(profiles.slug, EXCLUDED.slug);

    -- Create actual tenant record
    INSERT INTO public.barbershops (owner_id, name, slug)
    VALUES (new.id, shop_name, generated_slug)
    ON CONFLICT (owner_id) DO NOTHING;
  ELSE
    -- Logic for clients, staff, professionals (Strict Isolation: No slug, No tenant)
    target_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    
    INSERT INTO public.profiles (
      id, responsible_name, display_name, email, role, status, slug, tenant_id
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'), 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'responsible_name'),
      new.email, user_role, 'active', NULL, target_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET 
      role = EXCLUDED.role,
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);
  END IF;

  -- Ensure RBAC record exists
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback
  END;

  RETURN new;
END;
$function$;

-- 2. Cleanup erroneous data
-- Remove empty tenants created by clients
DELETE FROM public.barbershops 
WHERE owner_id IN (
  SELECT id FROM public.profiles 
  WHERE role = 'client'
)
AND id NOT IN (SELECT tenant_id FROM public.appointments);

-- Clear slugs from client profiles
UPDATE public.profiles 
SET slug = NULL 
WHERE role = 'client' AND slug IS NOT NULL;
