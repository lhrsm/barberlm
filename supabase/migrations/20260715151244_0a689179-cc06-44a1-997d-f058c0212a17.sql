CREATE OR REPLACE FUNCTION public.get_reschedule_options(
  p_appointment_id uuid,
  p_barber_id uuid DEFAULT NULL,
  p_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appt record;
  v_duration integer := 30;
  v_link_count integer := 0;
  v_barbers jsonb := '[]'::jsonb;
  v_times jsonb := '[]'::jsonb;
  v_target_barber record;
  v_day_key text;
  v_wh jsonb;
  v_start_hm text;
  v_end_hm text;
  v_start_hour integer;
  v_start_min integer;
  v_end_hour integer;
  v_end_min integer;
  v_hour integer;
  v_min integer;
  v_time_text text;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_is_busy boolean;
  v_now_br timestamp;
BEGIN
  SELECT a.* INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agendamento não encontrado',
      'barbers', '[]'::jsonb,
      'times', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(s.duration_minutes, GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30)
    INTO v_duration
  FROM public.services s
  WHERE s.id = v_appt.service_id;

  IF v_duration IS NULL THEN
    v_duration := COALESCE(GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30);
  END IF;

  SELECT count(*) INTO v_link_count
  FROM public.barber_services bs
  WHERE bs.service_id = v_appt.service_id;

  WITH eligible AS (
    SELECT DISTINCT b.id, b.name, b.avatar_url, b.specialties, b.category, b.working_hours, b.active
    FROM public.barbers b
    WHERE COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id)
      AND (
        v_link_count = 0
        OR EXISTS (
          SELECT 1
          FROM public.barber_services bs
          WHERE bs.barber_id = b.id
            AND bs.service_id = v_appt.service_id
        )
        OR b.id = v_appt.barber_id
      )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'avatar_url', e.avatar_url,
        'specialties', COALESCE(to_jsonb(e.specialties), '[]'::jsonb),
        'category', e.category,
        'working_hours', COALESCE(e.working_hours, '{}'::jsonb),
        'is_active', e.active,
        'is_current', e.id = v_appt.barber_id
      )
      ORDER BY CASE WHEN e.id = v_appt.barber_id THEN 0 ELSE 1 END, e.name
    ),
    '[]'::jsonb
  ) INTO v_barbers
  FROM eligible e;

  IF p_barber_id IS NOT NULL AND p_date IS NOT NULL THEN
    SELECT b.* INTO v_target_barber
    FROM public.barbers b
    WHERE b.id = p_barber_id
      AND COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id);

    IF FOUND THEN
      v_day_key := CASE extract(dow FROM p_date)::int
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
      END;

      v_wh := v_target_barber.working_hours -> v_day_key;

      IF v_wh IS NOT NULL AND COALESCE((v_wh ->> 'enabled')::boolean, false) THEN
        v_start_hm := v_wh ->> 'start';
        v_end_hm := v_wh ->> 'end';

        v_start_hour := split_part(v_start_hm, ':', 1)::int;
        v_start_min := split_part(v_start_hm, ':', 2)::int;
        v_end_hour := split_part(v_end_hm, ':', 1)::int;
        v_end_min := split_part(v_end_hm, ':', 2)::int;
        v_now_br := now() AT TIME ZONE 'America/Sao_Paulo';

        v_hour := v_start_hour;
        WHILE v_hour <= v_end_hour LOOP
          v_min := CASE WHEN v_hour = v_start_hour THEN v_start_min ELSE 0 END;
          WHILE v_min < 60 LOOP
            EXIT WHEN v_hour = v_end_hour AND v_min >= v_end_min;

            v_time_text := lpad(v_hour::text, 2, '0') || ':' || lpad(v_min::text, 2, '0');
            v_slot_start := (p_date::text || ' ' || v_time_text || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
            v_slot_end := v_slot_start + make_interval(mins => v_duration);

            IF ((p_date::text || ' ' || v_time_text || ':00')::timestamp >= v_now_br)
               AND ((v_slot_end AT TIME ZONE 'America/Sao_Paulo')::time <= v_end_hm::time) THEN
              SELECT EXISTS (
                SELECT 1
                FROM public.appointments a
                WHERE a.barber_id = p_barber_id
                  AND a.id <> p_appointment_id
                  AND a.status IN ('scheduled', 'confirmed', 'in_progress', 'awaiting_payment', 'pending')
                  AND a.start_time < v_slot_end
                  AND a.end_time > v_slot_start
              ) INTO v_is_busy;

              IF NOT v_is_busy THEN
                v_times := v_times || to_jsonb(v_time_text);
              END IF;
            END IF;

            v_min := v_min + 30;
          END LOOP;
          v_hour := v_hour + 1;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'durationMinutes', v_duration,
    'barbers', v_barbers,
    'times', v_times
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reschedule_options(uuid, uuid, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reschedule_options(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reschedule_options(uuid, uuid, date) TO service_role;