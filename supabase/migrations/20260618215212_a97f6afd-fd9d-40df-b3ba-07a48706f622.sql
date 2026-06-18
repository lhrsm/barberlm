CREATE OR REPLACE FUNCTION public.get_barber_appointments(p_barber_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.start_time DESC), '[]'::jsonb)
  FROM (
    SELECT
      a.*,
      jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'avatar_url', c.avatar_url
      ) AS customers,
      jsonb_build_object(
        'name', s.name
      ) AS services
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services  s ON s.id = a.service_id
    WHERE a.barber_id = p_barber_id
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_appointments(uuid) TO anon, authenticated;