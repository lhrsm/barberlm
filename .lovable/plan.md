# Architectural Repair: Multi-Tenant Isolation & Slug Correction

Address the issue where customers (clients) are incorrectly generating their own tenants and slugs, causing incorrect URL routing (e.g., `/louis-henrique-19/portal` instead of `/lm/portal`).

## User Review Required

> [!IMPORTANT]
> The database trigger `handle_new_user` will be modified to prevent automatic tenant creation for users registered with the `role: 'client'`. I will also perform a targeted cleanup of the incorrect tenant and slug for Louis Menezes.

## Proposed Changes

### 1. Database Layer (Supabase)
- **Modify Trigger `handle_new_user`**: Update the PL/pgSQL function to inspect `new.raw_user_meta_data->>'role'`. 
    - If role is `'client'`, skip the `INSERT` into `public.barbershops` and do not generate/assign a `slug` in `public.profiles`.
- **Data Cleanup**:
    - Identify and remove the erroneous tenant `minha-barbearia` (ID: `2b922aa6-f218-4053-9036-6001d1bbb33d`).
    - Remove the slug `louis-henrique-19` from the profile of user `997746ee-723f-40e4-a6c6-5359eddd2a98`.

### 2. Frontend Layer (React/TanStack)
- **ClientLoginForm.tsx**: Refactor the redirect logic. 
    - Stop using `result.user.slug` as a fallback for portal routing. 
    - Strictly use the `barbershopSlug` from props (context-aware) or a generic `/portal` (if global).
- **use-auth.ts**: Audit the `profile.slug` usage. Ensure that for `role: 'client'`, the slug is ignored or explicitly nullified in the hook state to prevent accidental usage in UI components.
- **Route Resolution**: Audit `src/routes/$slug.tsx` and `src/routes/$slug.portal.tsx` to ensure they strictly resolve the tenant via the URL slug and do not permit "customer slugs" to act as tenant entry points.

### 3. Identity Engine Hardening
- **finalizeAuthSetup**: Ensure that when linking a customer to an auth user, the `role` is explicitly passed as `'client'` to the admin Auth API so the corrected trigger behaves correctly.

## Technical Details

### SQL Migration
```sql
-- Update handle_new_user to be role-aware
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
BEGIN
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'tenant_admin');
  
  -- Logic for tenant admins (barbershop owners)
  IF user_role = 'tenant_admin' OR user_role = 'admin' OR user_role = 'super_admin' THEN
    shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
    generated_slug := generate_unique_slug(shop_name);

    INSERT INTO public.profiles (id, business_name, responsible_name, email, role, status, slug)
    VALUES (new.id, shop_name, new.raw_user_meta_data->>'responsible_name', new.email, user_role, 'active', generated_slug)
    ON CONFLICT (id) DO UPDATE SET slug = COALESCE(profiles.slug, EXCLUDED.slug);

    INSERT INTO public.barbershops (owner_id, name, slug)
    VALUES (new.id, shop_name, generated_slug)
    ON CONFLICT (owner_id) DO NOTHING;
  ELSE
    -- Logic for clients, staff, professionals (no tenant/slug creation)
    INSERT INTO public.profiles (id, responsible_name, email, role, status, slug, tenant_id)
    VALUES (new.id, new.raw_user_meta_data->>'responsible_name', new.email, user_role, 'active', NULL, (new.raw_user_meta_data->>'tenant_id')::uuid)
    ON CONFLICT (id) DO UPDATE SET 
      role = EXCLUDED.role,
      tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, user_role::app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;
```

## Acceptance Criteria
- [ ] Clients do not have a `slug` in their `profiles` record.
- [ ] No new `barbershops` are created when registering a client via the booking flow.
- [ ] Louis Menezes (`louishenrique19@hotmail.com`) is redirected to `/lm/portal` after login, not `/louis-henrique-19/portal`.
- [ ] The admin (`louisdabahia@gmail.com`) can still manage the `lm` tenant normally.
