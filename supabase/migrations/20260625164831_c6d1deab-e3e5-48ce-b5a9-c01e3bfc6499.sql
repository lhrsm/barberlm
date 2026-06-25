CREATE TABLE IF NOT EXISTS public.barber_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  customer_id uuid,
  service_id uuid,
  service_name text,
  service_amount numeric(10,2) NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage',
  commission_percentage numeric(10,2) NOT NULL DEFAULT 0,
  commission_fixed_amount numeric(10,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_commissions_appointment_barber_key UNIQUE (appointment_id, barber_id)
);

ALTER TABLE public.barber_commissions
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS barber_id uuid,
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS service_id uuid,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS service_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_fixed_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'barber_commissions_status_check'
      AND conrelid = 'public.barber_commissions'::regclass
  ) THEN
    ALTER TABLE public.barber_commissions
      ADD CONSTRAINT barber_commissions_status_check CHECK (status IN ('pending','paid','cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'barber_commissions_appointment_barber_key'
      AND conrelid = 'public.barber_commissions'::regclass
  ) THEN
    ALTER TABLE public.barber_commissions
      ADD CONSTRAINT barber_commissions_appointment_barber_key UNIQUE (appointment_id, barber_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_commissions TO authenticated;
GRANT SELECT ON public.barber_commissions TO anon;
GRANT ALL ON public.barber_commissions TO service_role;

ALTER TABLE public.barber_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage barber commissions" ON public.barber_commissions;
CREATE POLICY "Tenant admins can manage barber commissions"
ON public.barber_commissions
FOR ALL
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Public can read commissions through scoped RPC only" ON public.barber_commissions;
CREATE POLICY "Public can read commissions through scoped RPC only"
ON public.barber_commissions
FOR SELECT
TO anon
USING (false);

CREATE INDEX IF NOT EXISTS idx_barber_commissions_tenant_barber_status
  ON public.barber_commissions (tenant_id, barber_id, status);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_created_at
  ON public.barber_commissions (created_at);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_appointment
  ON public.barber_commissions (appointment_id);

CREATE OR REPLACE FUNCTION public.update_barber_commissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_barber_commissions_updated_at ON public.barber_commissions;
CREATE TRIGGER trg_update_barber_commissions_updated_at
BEFORE UPDATE ON public.barber_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_barber_commissions_updated_at();

CREATE OR REPLACE FUNCTION public.create_barber_commission_for_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt record;
  v_barber record;
  v_service_amount numeric(10,2) := 0;
  v_commission_type text := 'percentage';
  v_percentage numeric(10,2) := 0;
  v_fixed numeric(10,2) := 0;
  v_bonus numeric(10,2) := 0;
  v_commission numeric(10,2) := 0;
  v_id uuid;
  v_status text;
BEGIN
  SELECT a.*, c.name AS customer_name, s.name AS service_name
    INTO v_appt
  FROM public.appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF COALESCE(v_appt.status, '') <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_completed');
  END IF;

  IF v_appt.barber_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_barber');
  END IF;

  SELECT * INTO v_barber
  FROM public.barbers
  WHERE id = v_appt.barber_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'barber_not_found');
  END IF;

  v_service_amount := COALESCE(v_appt.service_amount, v_appt.original_total, v_appt.total_price, 0);
  v_commission_type := COALESCE(NULLIF(v_barber.commission_type, ''), 'percentage');
  v_percentage := COALESCE(v_barber.commission_rate, 0);
  v_fixed := COALESCE(v_barber.commission_fixed_value, 0);
  v_bonus := COALESCE(v_barber.commission_bonus_value, 0);

  IF v_commission_type = 'fixed' THEN
    v_commission := v_fixed;
  ELSIF v_commission_type = 'hybrid' THEN
    v_commission := (v_service_amount * v_percentage / 100) + v_bonus;
  ELSE
    v_commission := v_service_amount * v_percentage / 100;
  END IF;

  v_commission := ROUND(GREATEST(v_commission, 0), 2);

  INSERT INTO public.barber_commissions (
    tenant_id, barber_id, appointment_id, customer_id, service_id, service_name,
    service_amount, commission_type, commission_percentage, commission_fixed_amount,
    commission_amount, status, created_at, updated_at
  ) VALUES (
    COALESCE(v_appt.tenant_id, v_barber.tenant_id, v_appt.user_id, v_barber.user_id),
    v_appt.barber_id,
    v_appt.id,
    v_appt.customer_id,
    v_appt.service_id,
    v_appt.service_name,
    v_service_amount,
    v_commission_type,
    CASE WHEN v_commission_type IN ('percentage','hybrid') THEN v_percentage ELSE 0 END,
    CASE WHEN v_commission_type = 'hybrid' THEN v_fixed + v_bonus ELSE v_fixed END,
    v_commission,
    'pending',
    COALESCE(v_appt.completed_at, now()),
    now()
  )
  ON CONFLICT (appointment_id, barber_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      customer_id = EXCLUDED.customer_id,
      service_id = EXCLUDED.service_id,
      service_name = EXCLUDED.service_name,
      service_amount = EXCLUDED.service_amount,
      commission_type = EXCLUDED.commission_type,
      commission_percentage = EXCLUDED.commission_percentage,
      commission_fixed_amount = EXCLUDED.commission_fixed_amount,
      commission_amount = CASE
        WHEN public.barber_commissions.status = 'pending' THEN EXCLUDED.commission_amount
        ELSE public.barber_commissions.commission_amount
      END,
      status = CASE
        WHEN public.barber_commissions.status = 'cancelled' THEN 'pending'
        ELSE public.barber_commissions.status
      END,
      created_at = COALESCE(public.barber_commissions.created_at, EXCLUDED.created_at),
      updated_at = now()
  RETURNING id, status INTO v_id, v_status;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_id,
    'service_amount', v_service_amount,
    'commission_amount', v_commission,
    'status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_barber_commission_for_appointment(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_barber_commission_summary(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_production numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_paid numeric(10,2) := 0;
  v_pending numeric(10,2) := 0;
  v_completed integer := 0;
  v_paid_count integer := 0;
  v_pending_count integer := 0;
  v_avg numeric(10,2) := 0;
BEGIN
  v_start := CASE WHEN p_start_date IS NULL THEN NULL ELSE p_start_date::timestamptz END;
  v_end := CASE WHEN p_end_date IS NULL THEN NULL ELSE (p_end_date + 1)::timestamptz END;

  SELECT
    COALESCE(SUM(bc.service_amount) FILTER (WHERE bc.status <> 'cancelled'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status <> 'cancelled'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status = 'paid'), 0),
    COALESCE(SUM(bc.commission_amount) FILTER (WHERE bc.status = 'pending'), 0),
    COUNT(*) FILTER (WHERE bc.status <> 'cancelled')::integer,
    COUNT(*) FILTER (WHERE bc.status = 'paid')::integer,
    COUNT(*) FILTER (WHERE bc.status = 'pending')::integer
  INTO v_production, v_total, v_paid, v_pending, v_completed, v_paid_count, v_pending_count
  FROM public.barber_commissions bc
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND (v_start IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) >= v_start)
    AND (v_end IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) < v_end);

  v_avg := CASE WHEN v_completed > 0 THEN ROUND(v_production / v_completed, 2) ELSE 0 END;

  RETURN jsonb_build_object(
    'production_total', v_production,
    'commission_total', v_total,
    'commission_paid', v_paid,
    'commission_pending', v_pending,
    'completed_appointments', v_completed,
    'paid_count', v_paid_count,
    'pending_count', v_pending_count,
    'average_ticket', v_avg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_commission_summary(uuid, uuid, date, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_barber_pending_commissions(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  appointment_id uuid,
  customer_id uuid,
  customer_name text,
  service_id uuid,
  service_name text,
  service_amount numeric,
  commission_amount numeric,
  status text,
  created_at timestamptz,
  appointment_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bc.id,
    bc.appointment_id,
    bc.customer_id,
    c.name AS customer_name,
    bc.service_id,
    bc.service_name,
    bc.service_amount,
    bc.commission_amount,
    bc.status,
    bc.created_at,
    a.start_time AS appointment_date
  FROM public.barber_commissions bc
  LEFT JOIN public.customers c ON c.id = bc.customer_id
  LEFT JOIN public.appointments a ON a.id = bc.appointment_id
  WHERE bc.tenant_id = p_tenant_id
    AND bc.barber_id = p_barber_id
    AND bc.status = 'pending'
    AND (p_start_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR COALESCE(a.completed_at, bc.created_at, a.start_time) < (p_end_date + 1)::timestamptz)
  ORDER BY COALESCE(a.start_time, bc.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_pending_commissions(uuid, uuid, date, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pay_barber_commissions(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_commission_ids uuid[],
  p_paid_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_total numeric(10,2) := 0;
BEGIN
  IF p_commission_ids IS NULL OR array_length(p_commission_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_commissions_selected');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(commission_amount), 0)
    INTO v_count, v_total
  FROM public.barber_commissions
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND status = 'pending'
    AND id = ANY(p_commission_ids);

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_commissions_found');
  END IF;

  UPDATE public.barber_commissions
  SET status = 'paid',
      paid_at = now(),
      paid_by = COALESCE(p_paid_by, p_tenant_id),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND status = 'pending'
    AND id = ANY(p_commission_ids);

  RETURN jsonb_build_object('success', true, 'paid_count', v_count, 'paid_total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_barber_commissions(uuid, uuid, uuid[], uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_commission_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_barber_commission_for_appointment(NEW.id);
  ELSIF NEW.status = 'cancelled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.barber_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE appointment_id = NEW.id
      AND barber_id = NEW.barber_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_on_appointment ON public.appointments;
CREATE TRIGGER trg_commission_on_appointment
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_commission_on_appointment();

CREATE OR REPLACE FUNCTION public.get_barber_dashboard_summary(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start date := date_trunc('month', now())::date;
  v_today date := now()::date;
  v_week_start date := (now()::date - 6);
  v_summary jsonb;
  v_today_count integer := 0;
  v_week_count integer := 0;
  v_cancelled integer := 0;
  v_next timestamptz;
BEGIN
  SELECT COUNT(*)::integer INTO v_today_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'completed'
    AND COALESCE(completed_at, start_time)::date = v_today;

  SELECT COUNT(*)::integer INTO v_week_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'completed'
    AND COALESCE(completed_at, start_time)::date >= v_week_start;

  SELECT COUNT(*)::integer INTO v_cancelled
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status = 'cancelled'
    AND COALESCE(cancelled_at, updated_at, start_time)::date >= v_month_start;

  SELECT start_time INTO v_next
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
    AND status IN ('scheduled','confirmed')
    AND start_time > now()
  ORDER BY start_time ASC
  LIMIT 1;

  v_summary := public.get_barber_commission_summary(
    p_tenant_id,
    p_barber_id,
    COALESCE(p_start_date, v_month_start),
    COALESCE(p_end_date, v_today)
  );

  RETURN jsonb_build_object(
    'appointments_today', v_today_count,
    'appointments_week', v_week_count,
    'appointments_month', COALESCE((v_summary->>'completed_appointments')::integer, 0),
    'gross_production', COALESCE((v_summary->>'production_total')::numeric, 0),
    'commission_generated', COALESCE((v_summary->>'commission_total')::numeric, 0),
    'commission_paid', COALESCE((v_summary->>'commission_paid')::numeric, 0),
    'commission_pending', COALESCE((v_summary->>'commission_pending')::numeric, 0),
    'average_ticket', COALESCE((v_summary->>'average_ticket')::numeric, 0),
    'cancelled_count', v_cancelled,
    'next_appointment', v_next
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_dashboard_summary(uuid, uuid, date, date) TO anon, authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.appointments
    WHERE status = 'completed'
      AND barber_id IS NOT NULL
  LOOP
    PERFORM public.create_barber_commission_for_appointment(r.id);
  END LOOP;

  UPDATE public.barber_commissions bc
  SET status = 'cancelled', updated_at = now()
  FROM public.appointments a
  WHERE a.id = bc.appointment_id
    AND a.status = 'cancelled'
    AND bc.status = 'pending';
END $$;