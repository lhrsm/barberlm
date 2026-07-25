-- 1) Buffer configurável entre atendimentos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slot_buffer_minutes integer NOT NULL DEFAULT 0;

-- 2) Função central de checagem de conflito (usada por app e triggers)
CREATE OR REPLACE FUNCTION public.check_appointment_conflict(
  p_barber_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_appointment_id uuid DEFAULT NULL,
  p_buffer_minutes integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buffer integer;
  v_tenant uuid;
  v_start_eff timestamptz;
  v_end_eff timestamptz;
  v_conflict uuid;
BEGIN
  IF p_barber_id IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RETURN false;
  END IF;

  -- Descobre o buffer padrão do tenant do profissional se não informado
  IF p_buffer_minutes IS NULL THEN
    SELECT b.tenant_id INTO v_tenant FROM public.barbers b WHERE b.id = p_barber_id;
    IF v_tenant IS NOT NULL THEN
      SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
      FROM public.profiles pr WHERE pr.id = v_tenant;
    END IF;
    v_buffer := COALESCE(v_buffer, 0);
  ELSE
    v_buffer := GREATEST(p_buffer_minutes, 0);
  END IF;

  v_start_eff := p_start - make_interval(mins => v_buffer);
  v_end_eff   := p_end   + make_interval(mins => v_buffer);

  SELECT a.id INTO v_conflict
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
    AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(v_start_eff, v_end_eff, '[)')
  LIMIT 1;

  RETURN v_conflict IS NOT NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.check_appointment_conflict(uuid, timestamptz, timestamptz, uuid, integer)
  TO anon, authenticated, service_role;

-- 3) Trigger central: recusa qualquer INSERT/UPDATE que gere sobreposição
CREATE OR REPLACE FUNCTION public.enforce_appointment_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só valida se linha ficará ativa (cancelled/no_show liberam o horário)
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  IF NEW.barber_id IS NULL OR NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.check_appointment_conflict(
    NEW.barber_id, NEW.start_time, NEW.end_time,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END,
    NULL
  ) THEN
    RAISE EXCEPTION 'Horário indisponível: já existe outro atendimento do profissional nesse intervalo'
      USING ERRCODE = 'P0001', HINT = 'appointment_overlap';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_no_overlap ON public.appointments;
CREATE TRIGGER trg_appointments_no_overlap
  BEFORE INSERT OR UPDATE OF barber_id, start_time, end_time, status
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_no_overlap();

-- 4) Walkin RPC: passa a usar a função central e o buffer configurável
CREATE OR REPLACE FUNCTION public.create_walkin_appointment(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_customer_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_total_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_end timestamptz := p_start_time + make_interval(mins => p_duration_minutes);
  v_new_id uuid;
  v_price numeric;
  v_is_owner boolean;
  v_role_ok boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  v_is_owner := (v_actor = p_tenant_id);
  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_actor
        AND role IN ('admin','super_admin','manager','receptionist')
    ) INTO v_role_ok;
  END IF;

  IF NOT (v_is_owner OR v_role_ok) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para criar atendimento presencial');
  END IF;

  IF public.check_appointment_conflict(p_barber_id, p_start_time, v_end, NULL, NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário indisponível para este profissional');
  END IF;

  IF p_total_price IS NULL THEN
    SELECT price INTO v_price FROM public.services WHERE id = p_service_id;
  ELSE
    v_price := p_total_price;
  END IF;

  INSERT INTO public.appointments (
    tenant_id, user_id, barber_id, customer_id, service_id,
    start_time, end_time, status, appointment_type,
    total_price, service_amount, final_amount,
    source, notes, walkin_arrived_at,
    updated_by_type, updated_by_id
  ) VALUES (
    p_tenant_id, p_tenant_id, p_barber_id, p_customer_id, p_service_id,
    p_start_time, v_end, 'scheduled', 'walk_in',
    v_price, v_price, COALESCE(v_price, 0),
    'walkin', p_notes, now(),
    'admin', v_actor
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_new_id);
END $$;

-- 5) Reschedule options: considera buffer configurável
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
  v_buffer integer := 0;
BEGIN
  SELECT a.* INTO v_appt FROM public.appointments a WHERE a.id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado', 'barbers', '[]'::jsonb, 'times', '[]'::jsonb);
  END IF;

  SELECT COALESCE(s.duration_minutes, GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30)
    INTO v_duration FROM public.services s WHERE s.id = v_appt.service_id;
  IF v_duration IS NULL THEN
    v_duration := COALESCE(GREATEST(15, ROUND(EXTRACT(EPOCH FROM (v_appt.end_time - v_appt.start_time)) / 60)::int), 30);
  END IF;

  SELECT COALESCE(pr.slot_buffer_minutes, 0) INTO v_buffer
  FROM public.profiles pr WHERE pr.id = v_appt.tenant_id;
  v_buffer := COALESCE(v_buffer, 0);

  SELECT count(*) INTO v_link_count FROM public.barber_services bs WHERE bs.service_id = v_appt.service_id;

  WITH eligible AS (
    SELECT DISTINCT b.id, b.name, b.avatar_url, b.specialties, b.category, b.working_hours, b.active
    FROM public.barbers b
    WHERE COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id)
      AND (
        v_link_count = 0
        OR EXISTS (SELECT 1 FROM public.barber_services bs WHERE bs.barber_id = b.id AND bs.service_id = v_appt.service_id)
        OR b.id = v_appt.barber_id
      )
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id, 'name', e.name, 'avatar_url', e.avatar_url,
      'specialties', COALESCE(to_jsonb(e.specialties), '[]'::jsonb),
      'category', e.category, 'working_hours', COALESCE(e.working_hours, '{}'::jsonb),
      'is_active', e.active, 'is_current', e.id = v_appt.barber_id
    ) ORDER BY CASE WHEN e.id = v_appt.barber_id THEN 0 ELSE 1 END, e.name
  ), '[]'::jsonb) INTO v_barbers FROM eligible e;

  IF p_barber_id IS NOT NULL AND p_date IS NOT NULL THEN
    SELECT b.* INTO v_target_barber FROM public.barbers b
    WHERE b.id = p_barber_id AND COALESCE(b.active, false) = true
      AND (b.tenant_id = v_appt.tenant_id OR b.user_id = v_appt.tenant_id);

    IF FOUND THEN
      v_day_key := CASE extract(dow FROM p_date)::int
        WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday'
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
              v_is_busy := public.check_appointment_conflict(
                p_barber_id, v_slot_start, v_slot_end, p_appointment_id, v_buffer
              );
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

  RETURN jsonb_build_object('success', true, 'durationMinutes', v_duration, 'barbers', v_barbers, 'times', v_times, 'bufferMinutes', v_buffer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reschedule_options(uuid, uuid, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_walkin_appointment(uuid,uuid,uuid,uuid,timestamptz,integer,numeric,text) TO authenticated;