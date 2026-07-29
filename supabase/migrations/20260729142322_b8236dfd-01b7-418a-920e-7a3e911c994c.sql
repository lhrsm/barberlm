CREATE OR REPLACE FUNCTION public.get_appointment_for_rating(p_cancel_token text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tenant_id uuid,
  barber_id uuid,
  service_id uuid,
  customer_id uuid,
  start_time timestamptz,
  status text,
  already_rated boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id,
         a.user_id,
         a.tenant_id,
         a.barber_id,
         a.service_id,
         a.customer_id,
         a.start_time,
         a.status,
         EXISTS (SELECT 1 FROM public.service_ratings sr WHERE sr.appointment_id = a.id) AS already_rated
  FROM public.appointments a
  WHERE p_cancel_token IS NOT NULL
    AND length(p_cancel_token) >= 6
    AND a.cancel_token::text = p_cancel_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_for_rating(text) TO anon, authenticated;

REVOKE SELECT (cancel_token, management_token) ON public.appointments FROM anon;