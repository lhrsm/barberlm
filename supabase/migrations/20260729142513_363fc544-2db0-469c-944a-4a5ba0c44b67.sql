CREATE OR REPLACE FUNCTION public.get_new_appointment_management_token(p_appointment_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.management_token::text
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.created_at > now() - interval '15 minutes'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_appointment_management_token(uuid) TO anon, authenticated;