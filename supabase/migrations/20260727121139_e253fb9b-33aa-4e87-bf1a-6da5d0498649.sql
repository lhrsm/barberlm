CREATE TABLE IF NOT EXISTS public.availability_conflict_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  barber_id uuid,
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  duration_minutes integer,
  buffer_minutes integer DEFAULT 0,
  source text NOT NULL DEFAULT 'unknown',
  result text NOT NULL DEFAULT 'conflict',
  conflicting jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.availability_conflict_logs TO authenticated;
GRANT ALL ON public.availability_conflict_logs TO service_role;

ALTER TABLE public.availability_conflict_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads own availability conflict logs"
ON public.availability_conflict_logs
FOR SELECT
TO authenticated
USING (tenant_id = auth.uid() OR public.is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_avail_conflict_logs_tenant_created
  ON public.availability_conflict_logs (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_availability_conflict(
  p_barber_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_source text DEFAULT 'unknown',
  p_result text DEFAULT 'conflict'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_buffer integer := 0;
  v_conflicting jsonb;
BEGIN
  IF p_barber_id IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RETURN;
  END IF;

  SELECT b.user_id INTO v_tenant FROM public.barbers b WHERE b.id = p_barber_id;
  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
    FROM public.profiles pr WHERE pr.id = v_tenant;

  SELECT jsonb_agg(jsonb_build_object('id', a.id, 'start_time', a.start_time, 'end_time', a.end_time, 'status', a.status))
    INTO v_conflicting
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.status NOT IN ('cancelled', 'no_show', 'completed')
    AND a.start_time < (p_end + make_interval(mins => COALESCE(v_buffer, 0)))
    AND a.end_time > (p_start - make_interval(mins => COALESCE(v_buffer, 0)));

  INSERT INTO public.availability_conflict_logs (
    tenant_id, barber_id, requested_start, requested_end, duration_minutes,
    buffer_minutes, source, result, conflicting
  ) VALUES (
    v_tenant, p_barber_id, p_start, p_end,
    GREATEST(1, (EXTRACT(EPOCH FROM (p_end - p_start)) / 60)::int),
    COALESCE(v_buffer, 0), COALESCE(p_source, 'unknown'), COALESCE(p_result, 'conflict'), v_conflicting
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_availability_conflict(uuid, timestamptz, timestamptz, text, text) TO anon, authenticated, service_role;