
-- 1. Recreate reschedule_appointment with optional new_barber_id + server-side validation
DROP FUNCTION IF EXISTS public.reschedule_appointment(uuid, timestamp with time zone, timestamp with time zone, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
    p_appointment_id uuid,
    p_new_start_time timestamp with time zone,
    p_new_end_time   timestamp with time zone,
    p_changed_by_type text DEFAULT 'system'::text,
    p_changed_by_id   uuid DEFAULT NULL::uuid,
    p_source          text DEFAULT 'rpc'::text,
    p_metadata        jsonb DEFAULT '{}'::jsonb,
    p_new_barber_id   uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt          record;
  v_barber        record;
  v_svc_link      integer;
  v_conflict      integer;
  v_old_start     timestamp with time zone;
  v_old_end       timestamp with time zone;
  v_old_barber_id uuid;
  v_new_barber_id uuid;
  v_barber_changed boolean := false;
  v_day_key       text;
  v_wh            jsonb;
  v_wh_enabled    boolean;
  v_wh_start      text;
  v_wh_end        text;
  v_local_start   timestamp;
  v_local_end     timestamp;
  v_start_hm      text;
  v_end_hm        text;
  v_log_created   boolean := false;
  v_log_error     text;
BEGIN
  -- 1. Fetch appointment
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento cancelado');
  END IF;
  IF v_appt.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento já concluído');
  END IF;

  -- v1: sem suporte a reagendamento de combos (appointment_groups)
  IF v_appt.appointment_group_id IS NOT NULL AND p_new_barber_id IS NOT NULL
     AND p_new_barber_id <> v_appt.barber_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reagendamento de combos ainda não permite troca de profissional'
    );
  END IF;

  v_old_start     := v_appt.start_time;
  v_old_end       := v_appt.end_time;
  v_old_barber_id := v_appt.barber_id;
  v_new_barber_id := COALESCE(p_new_barber_id, v_appt.barber_id);
  v_barber_changed := (v_new_barber_id IS DISTINCT FROM v_old_barber_id);

  -- 2. If barber will change, validate the new barber
  IF v_barber_changed THEN
    SELECT * INTO v_barber
      FROM public.barbers
     WHERE id = v_new_barber_id
       AND tenant_id = v_appt.tenant_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado nesta barbearia');
    END IF;
    IF COALESCE(v_barber.active, false) = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional inativo');
    END IF;

    -- vinculado ao serviço?
    IF v_appt.service_id IS NOT NULL THEN
      SELECT count(*) INTO v_svc_link
        FROM public.barber_services
       WHERE barber_id = v_new_barber_id
         AND service_id = v_appt.service_id;
      IF v_svc_link = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profissional não realiza este serviço');
      END IF;
    END IF;

    -- jornada configurada?
    v_wh := v_barber.working_hours;
    IF v_wh IS NULL OR v_wh = '{}'::jsonb THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional sem agenda configurada');
    END IF;
  END IF;

  -- 3. Validate working hours & window for the target barber (new or same)
  IF v_barber_changed THEN
    v_wh := v_barber.working_hours;
  ELSE
    SELECT working_hours INTO v_wh FROM public.barbers WHERE id = v_new_barber_id;
  END IF;

  IF v_wh IS NOT NULL AND v_wh <> '{}'::jsonb THEN
    v_local_start := (p_new_start_time AT TIME ZONE 'America/Sao_Paulo');
    v_local_end   := (p_new_end_time   AT TIME ZONE 'America/Sao_Paulo');
    v_day_key := CASE extract(dow FROM v_local_start)::int
      WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday' END;
    v_wh_enabled := COALESCE((v_wh -> v_day_key ->> 'enabled')::boolean, false);
    v_wh_start   := v_wh -> v_day_key ->> 'start';
    v_wh_end     := v_wh -> v_day_key ->> 'end';

    IF NOT v_wh_enabled THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profissional não trabalha neste dia');
    END IF;

    v_start_hm := to_char(v_local_start, 'HH24:MI');
    v_end_hm   := to_char(v_local_end,   'HH24:MI');
    IF v_wh_start IS NOT NULL AND v_start_hm < v_wh_start THEN
      RETURN jsonb_build_object('success', false, 'error', 'Horário fora do expediente do profissional');
    END IF;
    IF v_wh_end IS NOT NULL AND v_end_hm > v_wh_end THEN
      RETURN jsonb_build_object('success', false, 'error', 'Horário fora do expediente do profissional');
    END IF;
  END IF;

  -- 4. Conflict check (excluding this appointment itself)
  SELECT count(*) INTO v_conflict
    FROM public.appointments
   WHERE barber_id = v_new_barber_id
     AND id <> p_appointment_id
     AND status NOT IN ('cancelled', 'no_show')
     AND start_time < p_new_end_time
     AND end_time   > p_new_start_time;

  IF v_conflict > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este horário acabou de ser ocupado. Escolha outro horário.',
      'code',    'slot_taken'
    );
  END IF;

  -- 5. Apply update
  UPDATE public.appointments
     SET start_time = p_new_start_time,
         end_time   = p_new_end_time,
         barber_id  = v_new_barber_id,
         updated_at = now(),
         updated_by_type = p_changed_by_type,
         updated_by_id   = p_changed_by_id,
         customer_action_source = CASE
           WHEN p_changed_by_type = 'customer' THEN p_source
           ELSE customer_action_source
         END
   WHERE id = p_appointment_id;

  -- 6. Log
  BEGIN
    INSERT INTO public.appointment_status_logs (
      appointment_id, old_status, new_status,
      status_before, status_after,
      changed_by_type, changed_by_id, source, metadata
    ) VALUES (
      p_appointment_id,
      v_appt.status, v_appt.status,
      v_appt.status, v_appt.status,
      p_changed_by_type, p_changed_by_id, p_source,
      p_metadata || jsonb_build_object(
        'action',              CASE WHEN v_barber_changed THEN 'reschedule_with_barber_change' ELSE 'reschedule' END,
        'old_start',           v_old_start,
        'new_start',           p_new_start_time,
        'old_end',             v_old_end,
        'new_end',             p_new_end_time,
        'previous_barber_id',  v_old_barber_id,
        'new_barber_id',       v_new_barber_id,
        'barber_changed',      v_barber_changed,
        'changed_at',          now()
      )
    );
    v_log_created := true;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',            true,
    'barber_changed',     v_barber_changed,
    'previous_barber_id', v_old_barber_id,
    'new_barber_id',      v_new_barber_id,
    'log_created',        v_log_created,
    'log_error',          v_log_error
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamp with time zone, timestamp with time zone, text, uuid, text, jsonb, uuid)
  TO anon, authenticated, service_role;

-- 2. Seed 4 templates for the new event "appointment.professional_changed" per tenant
INSERT INTO public.automation_templates
  (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT
  p.id,
  'appointment.professional_changed.customer',
  'Troca de profissional — Cliente',
  'appointment.professional_changed',
  'customer',
  'appointment',
  'whatsapp',
  E'🔄 *AGENDAMENTO REAGENDADO*\n\nOlá, {{customer_name}}!\n\nSeu atendimento foi atualizado com sucesso.\n\n━━━━━━━━━━━━━━━━━━━━\n\n✂ *Serviço:*\n{{service_name}}\n\n💈 *Profissional anterior:*\n{{old_professional_name}}\n\n💈 *Novo profissional:*\n{{new_professional_name}}\n\n📅 *Data anterior:*\n{{old_date}} às {{old_time}}\n\n📅 *Nova data:*\n{{new_date}} às {{new_time}}\n\n💰 *Valor:*\n{{service_price}}\n\n💳 *Pagamento:*\n{{payment_method}}\n\n━━━━━━━━━━━━━━━━━━━━\n\nCaso precise alterar novamente ou cancelar:\n{{management_link}}\n\nEquipe {{barbershop_name}} 💈',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
   WHERE t.tenant_id = p.id
     AND t.key = 'appointment.professional_changed.customer'
);

INSERT INTO public.automation_templates
  (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT
  p.id,
  'appointment.professional_changed.previous_barber',
  'Troca de profissional — Profissional anterior',
  'appointment.professional_changed',
  'previous_barber',
  'appointment',
  'whatsapp',
  E'📤 *ATENDIMENTO REMOVIDO DA SUA AGENDA*\n\nO atendimento abaixo foi transferido para outro profissional.\n\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Cliente:*\n{{customer_name}}\n\n✂ *Serviço:*\n{{service_name}}\n\n📅 *Horário anterior:*\n{{old_date}} às {{old_time}}\n\n💈 *Novo profissional:*\n{{new_professional_name}}\n\n*Alterado por:*\n{{actor_label}}\n\n━━━━━━━━━━━━━━━━━━━━\n\nGerenciar atendimento:\n{{management_link}}\n\n_Mensagem automática do Barbex._',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
   WHERE t.tenant_id = p.id
     AND t.key = 'appointment.professional_changed.previous_barber'
);

INSERT INTO public.automation_templates
  (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT
  p.id,
  'appointment.professional_changed.new_barber',
  'Troca de profissional — Novo profissional',
  'appointment.professional_changed',
  'new_barber',
  'appointment',
  'whatsapp',
  E'📥 *NOVO ATENDIMENTO NA SUA AGENDA*\n\nVocê recebeu um atendimento transferido.\n\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Cliente:*\n{{customer_name}}\n\n📞 *Telefone:*\n{{customer_phone}}\n\n✂ *Serviço:*\n{{service_name}}\n\n📅 *Data:*\n{{new_date}}\n\n⏰ *Horário:*\n{{new_time}}\n\n💰 *Valor:*\n{{service_price}}\n\n💳 *Pagamento:*\n{{payment_method}}\n\n*Profissional anterior:*\n{{old_professional_name}}\n\n*Alterado por:*\n{{actor_label}}\n\n━━━━━━━━━━━━━━━━━━━━\n\nGerenciar atendimento:\n{{management_link}}\n\n_Mensagem automática do Barbex._',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
   WHERE t.tenant_id = p.id
     AND t.key = 'appointment.professional_changed.new_barber'
);

INSERT INTO public.automation_templates
  (tenant_id, key, name, trigger_event, recipient, category, channel, template, active)
SELECT
  p.id,
  'appointment.professional_changed.shop',
  'Troca de profissional — Barbearia',
  'appointment.professional_changed',
  'shop',
  'appointment',
  'whatsapp',
  E'🔁 *PROFISSIONAL DO AGENDAMENTO ALTERADO*\n\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Cliente:*\n{{customer_name}}\n\n✂ *Serviço:*\n{{service_name}}\n\n💈 *Profissional anterior:*\n{{old_professional_name}}\n\n💈 *Novo profissional:*\n{{new_professional_name}}\n\n📅 *Antes:*\n{{old_date}} às {{old_time}}\n\n📅 *Agora:*\n{{new_date}} às {{new_time}}\n\n💰 *Valor:*\n{{service_price}}\n\n💳 *Pagamento:*\n{{payment_method}}\n\n*Alterado por:*\n{{actor_label}}\n\n━━━━━━━━━━━━━━━━━━━━\n\nGerenciar atendimento:\n{{management_link}}\n\n_Mensagem automática do Barbex._',
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t
   WHERE t.tenant_id = p.id
     AND t.key = 'appointment.professional_changed.shop'
);
