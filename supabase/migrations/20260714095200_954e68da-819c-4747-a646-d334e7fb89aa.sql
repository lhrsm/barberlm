
-- Replace non-existent profiles.full_name with responsible_name in trigger functions

CREATE OR REPLACE FUNCTION public.trg_notify_admin_revenue_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month_start timestamptz;
  v_month_key text;
  v_total numeric;
  v_prev_total numeric;
  v_threshold numeric;
  v_shop_name text;
  v_thresholds numeric[] := ARRAY[1000, 5000, 10000, 50000, 100000];
BEGIN
  IF NEW.tenant_id IS NULL OR COALESCE(NEW.type, '') <> 'income' THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', COALESCE(NEW.created_at, now()));
  v_month_key := to_char(v_month_start, 'YYYY-MM');

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.transactions
  WHERE tenant_id = NEW.tenant_id
    AND type = 'income'
    AND created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  v_prev_total := v_total - COALESCE(NEW.amount, 0);

  SELECT COALESCE(business_name, responsible_name, email) INTO v_shop_name
  FROM public.profiles WHERE id = NEW.tenant_id;

  FOREACH v_threshold IN ARRAY v_thresholds LOOP
    IF v_prev_total < v_threshold AND v_total >= v_threshold THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.admin_event_log
        WHERE event_key = 'revenue.milestone'
          AND tenant_id = NEW.tenant_id
          AND payload->>'month' = v_month_key
          AND (payload->>'threshold')::numeric = v_threshold
      ) THEN
        PERFORM public.emit_admin_event_panel(
          'revenue.milestone',
          'info',
          'Marco de receita atingido 🎉',
          COALESCE(v_shop_name, 'Barbearia') || ' cruzou R$ ' || to_char(v_threshold, 'FM999G999') || ' em ' || v_month_key,
          NEW.tenant_id,
          '/admin/finance',
          jsonb_build_object('threshold', v_threshold, 'total', v_total, 'month', v_month_key)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_tenant_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.business_name IS NOT NULL OR NEW.role IN ('admin', 'shop_owner') THEN
    PERFORM public.emit_admin_event_panel(
      'tenant.signup',
      'Nova barbearia cadastrada',
      COALESCE(NEW.business_name, NEW.responsible_name, NEW.email, 'Sem nome'),
      'info',
      NEW.id,
      '/admin/tenants',
      jsonb_build_object(
        'tenant_id', NEW.id,
        'business_name', NEW.business_name,
        'email', NEW.email,
        'plan', NEW.plan
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Also patch the support ticket notifier which shares the same faulty lookup
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.trg_notify_admin_support_ticket'::regproc) INTO v_def;
  v_def := replace(v_def, 'business_name, full_name, email', 'business_name, responsible_name, email');
  EXECUTE v_def;
END $$;

-- Subscription automation & renewal reminders reference the same column
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.trigger_subscription_automation'::regproc) INTO v_def;
  v_def := replace(v_def, 'business_name, full_name,', 'business_name, responsible_name,');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.enqueue_subscription_renewal_reminders'::regproc) INTO v_def;
  v_def := replace(v_def, 'business_name, full_name,', 'business_name, responsible_name,');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.handle_appointment_automation'::regproc) INTO v_def;
  v_def := replace(v_def, 'SELECT full_name INTO v_professional_name FROM public.profiles', 'SELECT responsible_name INTO v_professional_name FROM public.profiles');
  EXECUTE v_def;
END $$;
