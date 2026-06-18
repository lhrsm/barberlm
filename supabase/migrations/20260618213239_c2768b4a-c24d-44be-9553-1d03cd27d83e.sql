CREATE OR REPLACE FUNCTION public.update_barber_working_hours(
  p_barber_id uuid,
  p_working_hours jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.barbers
  SET working_hours = p_working_hours,
      updated_at = now()
  WHERE id = p_barber_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_barber_working_hours(uuid, jsonb) TO anon, authenticated, service_role;