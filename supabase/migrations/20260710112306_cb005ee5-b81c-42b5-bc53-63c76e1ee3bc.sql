
CREATE OR REPLACE FUNCTION public.get_review_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'tenant_id', r.tenant_id,
    'appointment_id', r.appointment_id,
    'customer_id', r.customer_id,
    'service_id', a.service_id,
    'customer_name', c.name,
    'barber_name', b.name,
    'barbershop_name', p.business_name,
    'barbershop_slug', p.slug,
    'service_name', s.name,
    'appointment_date', a.start_time,
    'submitted_at', r.submitted_at,
    'token_used_at', r.token_used_at,
    'already_submitted', (r.submitted_at IS NOT NULL OR r.token_used_at IS NOT NULL)
  ) INTO result
  FROM public.appointment_reviews r
  JOIN public.appointments a ON a.id = r.appointment_id
  LEFT JOIN public.customers c ON c.id = r.customer_id
  LEFT JOIN public.barbers b ON b.id = r.barber_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = r.tenant_id
  WHERE r.review_token = _token
  LIMIT 1;

  RETURN result;
END;
$function$;
