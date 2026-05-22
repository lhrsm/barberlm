CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
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
    status
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'business_name', 'Minha Barbearia'),
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
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    responsible_name = EXCLUDED.responsible_name,
    email = EXCLUDED.email,
    whatsapp_number = EXCLUDED.whatsapp_number,
    barbers_range = EXCLUDED.barbers_range,
    plan = EXCLUDED.plan,
    trial_end = EXCLUDED.trial_end;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'tenant_admin')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;
