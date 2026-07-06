
CREATE OR REPLACE FUNCTION public.create_or_get_public_customer(
  p_slug text,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_barber_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_owner_id uuid;
  v_phone text;
  v_customer_id uuid;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RAISE EXCEPTION 'slug_required'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_phone IS NULL THEN RAISE EXCEPTION 'phone_required'; END IF;

  v_phone := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_phone) < 8 THEN RAISE EXCEPTION 'invalid_phone'; END IF;

  SELECT id, owner_id INTO v_shop_id, v_owner_id
  FROM public.barbershops
  WHERE slug = p_slug
  LIMIT 1;

  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'barbershop_not_found'; END IF;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'barbershop_owner_missing'; END IF;

  -- Match by phone against either owner_id or shop id (legacy rows)
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE (user_id = v_owner_id OR user_id = v_shop_id OR tenant_id = v_owner_id OR tenant_id = v_shop_id)
    AND regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_phone
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET name = COALESCE(NULLIF(trim(p_name), ''), name),
        email = COALESCE(p_email, email)
    WHERE id = v_customer_id;
    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (
    user_id, tenant_id, barber_id, name, phone, email
  ) VALUES (
    v_owner_id, v_owner_id, p_barber_id, trim(p_name), v_phone, p_email
  )
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;
