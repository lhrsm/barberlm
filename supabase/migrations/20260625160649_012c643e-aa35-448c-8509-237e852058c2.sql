
-- 1) Cashback gating in complete_appointment
CREATE OR REPLACE FUNCTION public.complete_appointment(
  p_appointment_id uuid,
  p_changed_by_type text DEFAULT 'system'::text,
  p_changed_by_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'rpc'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
      RETURN jsonb_build_object('success', true, 'already', true);
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

    -- ===== Cashback gating =====
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
          'subscription_covered', v_sub_covered
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
      'cashback_blocked_by_module', v_cashback_blocked_by_module
    );
END;
$function$;

-- 2) Defensive trigger: block earned cashback when disabled on tenant
CREATE OR REPLACE FUNCTION public.tg_block_disabled_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.type = 'earned' THEN
    SELECT COALESCE(cashback_enabled, false) INTO v_enabled
      FROM public.profiles WHERE id = NEW.tenant_id;
    IF NOT v_enabled THEN
      RAISE NOTICE 'Cashback ledger insert ignored: cashback is disabled for tenant %', NEW.tenant_id;
      RETURN NULL;  -- swallow the insert silently
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_disabled_cashback ON public.cashback_transactions;
CREATE TRIGGER trg_block_disabled_cashback
  BEFORE INSERT ON public.cashback_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_disabled_cashback();

-- 3) Unified barber dashboard summary
CREATE OR REPLACE FUNCTION public.get_barber_dashboard_summary(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_week_start timestamptz := date_trunc('week', now());
  v_week_end timestamptz := v_week_start + interval '7 days';
  v_month_start timestamptz := COALESCE(p_start_date, date_trunc('month', now())::date)::timestamptz;
  v_month_end timestamptz := COALESCE(p_end_date + interval '1 day', date_trunc('month', now()) + interval '1 month')::timestamptz;
  v_appointments_today int := 0;
  v_appointments_week int := 0;
  v_appointments_month int := 0;
  v_completed_count int := 0;
  v_cancelled_count int := 0;
  v_gross numeric := 0;
  v_avg numeric := 0;
  v_commission_generated numeric := 0;
  v_commission_paid numeric := 0;
  v_commission_pending numeric := 0;
  v_next_appt timestamptz;
BEGIN
  v_start := v_month_start;
  v_end := v_month_end;

  SELECT COUNT(*) FILTER (WHERE start_time >= v_today_start AND start_time < v_today_end AND status <> 'cancelled'),
         COUNT(*) FILTER (WHERE start_time >= v_week_start AND start_time < v_week_end AND status <> 'cancelled'),
         COUNT(*) FILTER (WHERE start_time >= v_start AND start_time < v_end AND status <> 'cancelled'),
         COUNT(*) FILTER (WHERE start_time >= v_start AND start_time < v_end AND status = 'completed'),
         COUNT(*) FILTER (WHERE start_time >= v_start AND start_time < v_end AND status = 'cancelled'),
         COALESCE(SUM(total_price) FILTER (WHERE start_time >= v_start AND start_time < v_end AND status = 'completed'), 0)
    INTO v_appointments_today, v_appointments_week, v_appointments_month,
         v_completed_count, v_cancelled_count, v_gross
    FROM public.appointments
   WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id;

  IF v_completed_count > 0 THEN
    v_avg := v_gross / v_completed_count;
  END IF;

  SELECT COALESCE(SUM(commission_amount), 0),
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
         COALESCE(SUM(commission_amount) FILTER (WHERE status <> 'paid'), 0)
    INTO v_commission_generated, v_commission_paid, v_commission_pending
    FROM public.commission_entries
   WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
     AND earned_at >= v_start AND earned_at < v_end;

  SELECT MIN(start_time) INTO v_next_appt
    FROM public.appointments
   WHERE tenant_id = p_tenant_id AND barber_id = p_barber_id
     AND start_time > now()
     AND status IN ('scheduled','confirmed');

  RETURN jsonb_build_object(
    'appointments_today', v_appointments_today,
    'appointments_week', v_appointments_week,
    'appointments_month', v_appointments_month,
    'completed_count', v_completed_count,
    'cancelled_count', v_cancelled_count,
    'gross_production', v_gross,
    'average_ticket', v_avg,
    'commission_generated', v_commission_generated,
    'commission_paid', v_commission_paid,
    'commission_pending', v_commission_pending,
    'next_appointment', v_next_appt
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_dashboard_summary(uuid, uuid, date, date) TO anon, authenticated, service_role;

-- 4) Cleanup helper: remove earned cashback created while disabled and rebalance customers
CREATE OR REPLACE FUNCTION public.cleanup_invalid_cashback(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_removed int := 0;
  v_balance_fix int := 0;
BEGIN
  SELECT COALESCE(cashback_enabled, false) INTO v_enabled FROM public.profiles WHERE id = p_tenant_id;
  IF v_enabled THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cashback_enabled');
  END IF;

  WITH del AS (
    DELETE FROM public.cashback_transactions
     WHERE tenant_id = p_tenant_id AND type = 'earned'
     RETURNING customer_id, amount
  ),
  rebal AS (
    SELECT customer_id, SUM(amount) AS total FROM del GROUP BY customer_id
  ),
  upd AS (
    UPDATE public.customers c
       SET cashback_balance = GREATEST(0, COALESCE(c.cashback_balance,0) - r.total),
           updated_at = now()
      FROM rebal r
     WHERE c.id = r.customer_id
     RETURNING c.id
  )
  SELECT (SELECT count(*) FROM del), (SELECT count(*) FROM upd) INTO v_removed, v_balance_fix;

  UPDATE public.appointments
     SET cashback_earned = 0
   WHERE tenant_id = p_tenant_id AND COALESCE(cashback_earned,0) > 0;

  RETURN jsonb_build_object('success', true, 'removed', v_removed, 'customers_updated', v_balance_fix);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_invalid_cashback(uuid) TO authenticated, service_role;
