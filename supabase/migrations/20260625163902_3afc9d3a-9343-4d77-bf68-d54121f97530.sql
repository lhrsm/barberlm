-- Official barber commission lifecycle
-- 1) Table
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
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_commissions_appointment_barber_key UNIQUE (appointment_id, barber_id)
);

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

-- 2) Generates or syncs a commission from a completed appointment.
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
    commission_amount, status
  ) VALUES (
    COALESCE(v_appt.tenant_id, v_barber.tenant_id, v_appt.user_id),
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
    'pending'
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
      updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_id,
    'service_amount', v_service_amount,
    'commission_amount', v_commission,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_barber_commission_for_appointment(uuid) TO anon, authenticated, service_role;

-- 3) Official summary source for professional dashboard/commission/financial tabs.
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
  v_avg numeric(10,2) := 0;
BEGIN
  v_start := CASE WHEN p_start_date IS NULL THEN NULL ELSE p_start_date::timestamptz END;
  v_end := CASE WHEN p_end_date IS NULL THEN NULL ELSE (p_end_date + 1)::timestamptz END;

  SELECT
    COALESCE(SUM(service_amount) FILTER (WHERE status <> 'cancelled'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status <> 'cancelled'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COUNT(*) FILTER (WHERE status <> 'cancelled')::integer
  INTO v_production, v_total, v_paid, v_pending, v_completed
  FROM public.barber_commissions
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND (v_start IS NULL OR created_at >= v_start)
    AND (v_end IS NULL OR created_at < v_end);

  v_avg := CASE WHEN v_completed > 0 THEN ROUND(v_production / v_completed, 2) ELSE 0 END;

  RETURN jsonb_build_object(
    'production_total', v_production,
    'commission_total', v_total,
    'commission_paid', v_paid,
    'commission_pending', v_pending,
    'completed_appointments', v_completed,
    'average_ticket', v_avg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_commission_summary(uuid, uuid, date, date) TO anon, authenticated, service_role;

-- 4) List pending commissions for payment modal.
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
    AND (p_start_date IS NULL OR bc.created_at >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR bc.created_at < (p_end_date + 1)::timestamptz)
  ORDER BY COALESCE(a.start_time, bc.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_pending_commissions(uuid, uuid, date, date) TO anon, authenticated, service_role;

-- 5) Authorize full/partial commission payment.
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

-- 6) Update appointment completion routine to create pending commission.
CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text DEFAULT 'system'::text, p_changed_by_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'rpc'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_extra_amount NUMERIC(10,2);
    v_cashbackable_base NUMERIC(10,2);
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_cashback_enabled BOOLEAN := false;
    v_existing_trans BOOLEAN;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
    v_cashback_blocked_by_subscription BOOLEAN := false;
    v_cashback_blocked_by_module BOOLEAN := false;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_income_amount NUMERIC(10,2);
    v_fully_covered BOOLEAN;
    v_commission_result jsonb;
BEGIN
    SELECT a.*, c.name as customer_name, s.name as service_name
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
    END IF;

    v_status_before := v_appt.status;
    IF v_appt.status = 'completed' THEN
      v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);
      RETURN jsonb_build_object('success', true, 'already', true, 'commission', v_commission_result);
    END IF;

    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    v_total_price := COALESCE(v_appt.total_price, 0);
    v_sub_covered := COALESCE(v_appt.subscription_covered_amount, 0);
    v_extra_amount := GREATEST(0, v_total_price - v_sub_covered);
    v_fully_covered := (v_sub_covered >= v_total_price AND v_total_price > 0);

    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, 0);
    v_card_amount := COALESCE((p_metadata->>'card_amount')::numeric, 0);

    IF v_fully_covered THEN
        v_final_amount := 0;
    ELSE
        v_final_amount := GREATEST(0, v_extra_amount - v_credit_used - v_cashback_used);
    END IF;

    IF v_fully_covered THEN
        v_payment_method := 'subscription';
        v_payment_status := 'covered_by_subscription';
    ELSE
        v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');
        v_payment_status := COALESCE(v_appt.payment_status, 'paid');
    END IF;

    v_cashback_enabled := COALESCE(v_tenant.cashback_enabled, false);
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    v_cashbackable_base := v_extra_amount;

    IF NOT v_cashback_enabled THEN
        v_cashback_blocked_by_module := true;
        v_cashback_earned := 0;
    ELSIF v_fully_covered THEN
        v_cashback_blocked_by_subscription := true;
        v_cashback_earned := 0;
    ELSIF v_cashback_percentage > 0 AND v_cashbackable_base > 0 THEN
        v_cashback_earned := (v_cashbackable_base * v_cashback_percentage) / 100;
        IF v_sub_covered > 0 THEN
            v_cashback_blocked_by_subscription := true;
        END IF;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id) INTO v_existing_trans;
    v_income_amount := v_extra_amount;

    IF NOT v_existing_trans AND v_income_amount > 0 THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente')
            || CASE WHEN v_sub_covered > 0 THEN ' (diferença assinatura)' ELSE '' END;

        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category,
            amount, pix_amount, cash_amount, credit_card_amount,
            credits_amount, cashback_amount, payment_method,
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_income_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE,
            jsonb_build_object(
                'pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount,
                'credits', v_credit_used, 'cashback', v_cashback_used,
                'subscription_covered', v_sub_covered,
                'total_price', v_total_price, 'extra_amount', v_extra_amount
            )
        );
    END IF;

    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, base_amount, type, description
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, v_cashbackable_base, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço') ||
                CASE WHEN v_sub_covered > 0 THEN ' (apenas valor extra)' ELSE '' END
            ) RETURNING id INTO v_cashback_tx_id;

            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    IF v_appt.subscription_id IS NOT NULL AND v_sub_covered > 0 THEN
        UPDATE public.subscription_usage_logs
        SET status = 'consumed',
            used_at = COALESCE(used_at, now())
        WHERE appointment_id = p_appointment_id
          AND (status IS NULL OR status NOT IN ('consumed','refunded'));
    END IF;

    UPDATE public.appointments
    SET status = 'completed',
        completed_at = now(),
        updated_at = now(),
        cashback_earned = v_cashback_earned,
        payment_method = v_payment_method,
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used
    WHERE id = p_appointment_id;

    v_commission_result := public.create_barber_commission_for_appointment(p_appointment_id);

    BEGIN
      INSERT INTO public.appointment_status_logs(
        appointment_id, tenant_id, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
      ) VALUES (
        p_appointment_id, v_appt.tenant_id, v_status_before, 'completed',
        p_changed_by_type, p_changed_by_id, p_source,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'cashback_earned', v_cashback_earned,
          'cashback_tx_id', v_cashback_tx_id,
          'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
          'cashback_blocked_by_module', v_cashback_blocked_by_module,
          'extra_amount', v_extra_amount,
          'subscription_covered', v_sub_covered,
          'barber_commission', v_commission_result
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'cashback_earned', v_cashback_earned,
      'cashback_skipped', v_cashback_skipped,
      'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
      'cashback_blocked_by_module', v_cashback_blocked_by_module,
      'commission', v_commission_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) TO anon, authenticated, service_role;

-- 7) Keep old dashboard RPC working, but source commission numbers from barber_commissions.
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

  v_summary := public.get_barber_commission_summary(p_tenant_id, p_barber_id, COALESCE(p_start_date, v_month_start), COALESCE(p_end_date, v_today));

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