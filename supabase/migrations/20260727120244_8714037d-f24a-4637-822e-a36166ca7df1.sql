CREATE OR REPLACE FUNCTION public.get_availability_slots(
  p_barber_id uuid,
  p_date date,
  p_duration_minutes integer DEFAULT 30,
  p_exclude_appointment_id uuid DEFAULT NULL,
  p_step_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz text := 'America/Sao_Paulo';
  v_barber record;
  v_tenant uuid;
  v_buffer integer := 0;
  v_wh jsonb;
  v_daykey text;
  v_duration integer := GREATEST(COALESCE(p_duration_minutes, 30), 5);
  v_step integer := GREATEST(COALESCE(p_step_minutes, 30), 5);
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_open timestamptz;
  v_close timestamptz;
  v_break_start timestamptz;
  v_break_end timestamptz;
  v_now timestamptz := now();
  v_cand timestamptz;
  v_end timestamptz;
  v_state text;
  v_slots jsonb := '[]'::jsonb;
  v_candidates timestamptz[] := ARRAY[]::timestamptz[];
  v_appt record;
BEGIN
  IF p_barber_id IS NULL OR p_date IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', 0, 'duration_minutes', v_duration);
  END IF;

  SELECT b.id, b.tenant_id, b.user_id, b.working_hours
    INTO v_barber
  FROM public.barbers b WHERE b.id = p_barber_id;

  IF v_barber.id IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', 0, 'duration_minutes', v_duration);
  END IF;

  v_tenant := COALESCE(v_barber.tenant_id, v_barber.user_id);
  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
  FROM public.profiles pr WHERE pr.id = v_tenant;
  v_buffer := GREATEST(COALESCE(v_buffer, 0), 0);

  v_daykey := lower(to_char(p_date, 'FMday'));
  v_daykey := CASE v_daykey
    WHEN 'sunday' THEN 'sunday' WHEN 'monday' THEN 'monday' WHEN 'tuesday' THEN 'tuesday'
    WHEN 'wednesday' THEN 'wednesday' WHEN 'thursday' THEN 'thursday'
    WHEN 'friday' THEN 'friday' ELSE 'saturday' END;

  v_wh := (COALESCE(v_barber.working_hours, '{}'::jsonb)) -> v_daykey;

  IF v_wh IS NULL OR COALESCE((v_wh->>'enabled')::boolean, false) IS NOT TRUE
     OR v_wh->>'start' IS NULL OR v_wh->>'end' IS NULL THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb, 'buffer_minutes', v_buffer, 'duration_minutes', v_duration, 'closed', true);
  END IF;

  v_open  := ((p_date::text || ' ' || (v_wh->>'start'))::timestamp) AT TIME ZONE v_tz;
  v_close := ((p_date::text || ' ' || (v_wh->>'end'))::timestamp) AT TIME ZONE v_tz;
  IF v_wh->>'break_start' IS NOT NULL AND v_wh->>'break_end' IS NOT NULL THEN
    v_break_start := ((p_date::text || ' ' || (v_wh->>'break_start'))::timestamp) AT TIME ZONE v_tz;
    v_break_end   := ((p_date::text || ' ' || (v_wh->>'break_end'))::timestamp) AT TIME ZONE v_tz;
  END IF;

  v_day_start := (p_date::text || ' 00:00:00')::timestamp AT TIME ZONE v_tz;
  v_day_end   := v_day_start + interval '1 day';

  -- Candidatos: grade regular do expediente
  v_cand := v_open;
  WHILE v_cand < v_close LOOP
    v_candidates := array_append(v_candidates, v_cand);
    v_cand := v_cand + make_interval(mins => v_step);
  END LOOP;

  -- Candidatos de encaixe: término real (+buffer) de cada atendimento do dia
  FOR v_appt IN
    SELECT a.start_time, a.end_time
    FROM public.appointments a
    WHERE a.barber_id = p_barber_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      AND a.start_time < v_day_end
      AND a.end_time > v_day_start
  LOOP
    v_cand := v_appt.end_time + make_interval(mins => v_buffer);
    IF v_cand > v_open AND v_cand < v_close AND NOT (v_cand = ANY (v_candidates)) THEN
      v_candidates := array_append(v_candidates, v_cand);
    END IF;
  END LOOP;

  FOREACH v_cand IN ARRAY (SELECT array_agg(x ORDER BY x) FROM unnest(v_candidates) x)
  LOOP
    v_end := v_cand + make_interval(mins => v_duration);
    v_state := 'available';

    IF v_end > v_close THEN
      v_state := 'overflow';
    ELSIF v_cand < v_now THEN
      v_state := 'past';
    ELSIF v_break_start IS NOT NULL AND v_cand < v_break_end AND v_end > v_break_start THEN
      v_state := 'busy';
    ELSIF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.barber_id = p_barber_id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND tstzrange(a.start_time - make_interval(mins => v_buffer),
                      a.end_time   + make_interval(mins => v_buffer), '[)')
            && tstzrange(v_cand, v_end, '[)')
    ) THEN
      v_state := 'busy';
    END IF;

    v_slots := v_slots || jsonb_build_object(
      'time', to_char(v_cand AT TIME ZONE v_tz, 'HH24:MI'),
      'end_time', to_char(v_end AT TIME ZONE v_tz, 'HH24:MI'),
      'iso', to_char(v_cand AT TIME ZONE v_tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'state', v_state
    );
  END LOOP;

  RETURN jsonb_build_object(
    'slots', v_slots,
    'buffer_minutes', v_buffer,
    'duration_minutes', v_duration,
    'open', to_char(v_open AT TIME ZONE v_tz, 'HH24:MI'),
    'close', to_char(v_close AT TIME ZONE v_tz, 'HH24:MI')
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_availability_slots(uuid, date, integer, uuid, integer) TO anon, authenticated, service_role;