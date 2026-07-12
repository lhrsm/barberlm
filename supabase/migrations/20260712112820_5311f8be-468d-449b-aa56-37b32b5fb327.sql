
DROP FUNCTION IF EXISTS public.get_appointment_group_by_token(TEXT);

CREATE FUNCTION public.get_appointment_group_by_token(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.appointment_groups%ROWTYPE;
  v_result JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO v_group FROM public.appointment_groups WHERE group_token = _token LIMIT 1;
  IF v_group.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'group', to_jsonb(v_group),
    'business', (SELECT jsonb_build_object('business_name', p.business_name, 'whatsapp_number', p.whatsapp_number, 'slug', p.slug) FROM public.profiles p WHERE p.id = v_group.tenant_id),
    'customer_name', (SELECT c.name FROM public.customers c WHERE c.id = v_group.customer_id),
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'service_id', a.service_id, 'barber_id', a.barber_id,
        'start_time', a.start_time, 'end_time', a.end_time, 'status', a.status,
        'service_amount', a.service_amount, 'group_sequence', a.group_sequence,
        'management_token', a.management_token,
        'service_name', s.name, 'professional_name', b.name
      ) ORDER BY a.group_sequence)
      FROM public.appointments a
      LEFT JOIN public.services s ON s.id = a.service_id
      LEFT JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.appointment_group_id = v_group.id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_appointment_group_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_group_by_token(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view appointment groups by token" ON public.appointment_groups;

-- profiles: column-level GRANTs para anon
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, business_name, whatsapp_number, whatsapp_enabled, primary_color, secondary_color,
  logo_url, slug, scheduling_mode, cashback_enabled, cashback_percentage, address,
  google_maps_url, free_service_threshold, font_family, font_size, font_color,
  cashback_type, cashback_fixed_value, cashback_minimum_amount, cashback_expiration_days,
  loyalty_mode, barbershop_logo_url, opening_date, cancellation_window_hours,
  barber_can_cancel, barber_can_reschedule, social_links, avatar_url, gallery_images,
  pix_qr_code_url, loyalty_reward_value, allow_notifications_on_business_phone,
  plan, effective_plan, tenant_id, role, created_at, updated_at
) ON public.profiles TO anon;
