
-- 1) Novas colunas em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS walkin_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS walkin_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS walkin_ticket_number integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_appointment_type_check
      CHECK (appointment_type IN ('online','walk_in'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_type_tenant
  ON public.appointments (tenant_id, appointment_type, status);

CREATE INDEX IF NOT EXISTS idx_appointments_walkin_barber_time
  ON public.appointments (barber_id, start_time)
  WHERE appointment_type = 'walk_in';

-- 2) Configuração de notificações para walk-in
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS walkin_send_notifications boolean NOT NULL DEFAULT false;

-- 3) RPC para criar atendimento presencial com validação de permissão + slot livre
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
  v_conflict uuid;
  v_new_id uuid;
  v_price numeric;
  v_is_owner boolean;
  v_role_ok boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Autorização: dono do tenant OU role admin/super_admin no user_roles
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

  -- Verifica conflito: qualquer appointment não cancelado do mesmo barbeiro sobrepondo
  SELECT id INTO v_conflict
  FROM public.appointments
  WHERE barber_id = p_barber_id
    AND status <> 'cancelled'
    AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, v_end, '[)')
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário indisponível para este profissional');
  END IF;

  -- Preço: se não vier, buscar do serviço
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

GRANT EXECUTE ON FUNCTION public.create_walkin_appointment(uuid,uuid,uuid,uuid,timestamptz,integer,numeric,text) TO authenticated;
