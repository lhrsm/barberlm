CREATE OR REPLACE FUNCTION public.generate_unique_slug(base_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_slug text;
  counter integer := 0;
BEGIN
  new_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  new_slug := trim(both '-' from new_slug);
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = new_slug) OR EXISTS (SELECT 1 FROM public.barbershops WHERE slug = new_slug) LOOP
    counter := counter + 1;
    new_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || counter;
    new_slug := trim(both '-' from new_slug);
  END LOOP;
  
  RETURN new_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  shop_name text;
  generated_slug text;
BEGIN
  shop_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia');
  generated_slug := generate_unique_slug(shop_name);

  INSERT INTO public.profiles (
    id, 
    business_name, 
    responsible_name,
    email,
    whatsapp_number,
    barbers_range,
    plan,
    trial_end,
    role, 
    status,
    slug
  )
  VALUES (
    new.id,
    shop_name,
    new.raw_user_meta_data->>'responsible_name',
    new.email,
    new.raw_user_meta_data->>'whatsapp_number',
    new.raw_user_meta_data->>'barbers_range',
    COALESCE(new.raw_user_meta_data->>'plan', 'pro'),
    CASE 
      WHEN (new.raw_user_meta_data->>'plan') = 'pro' OR new.raw_user_meta_data->>'plan' IS NULL 
      THEN (now() + interval '15 days') 
      ELSE NULL 
    END,
    'tenant_admin',
    'active',
    generated_slug
  )
  ON CONFLICT (id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    responsible_name = EXCLUDED.responsible_name,
    email = EXCLUDED.email,
    whatsapp_number = EXCLUDED.whatsapp_number,
    barbers_range = EXCLUDED.barbers_range,
    plan = EXCLUDED.plan,
    trial_end = EXCLUDED.trial_end,
    slug = COALESCE(profiles.slug, EXCLUDED.slug);

  -- Create the barbershop record
  INSERT INTO public.barbershops (
    owner_id,
    name,
    slug
  )
  VALUES (
    new.id,
    shop_name,
    generated_slug
  )
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'tenant_admin')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;
