
-- 1) Trigger function for customer_subscriptions lifecycle events
CREATE OR REPLACE FUNCTION public.trigger_subscription_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_name TEXT;
  v_workflow_key TEXT;
  v_template RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_barbershop_name TEXT;
  v_subscription_amount TEXT;
  v_renewal_date TEXT;
  v_idem TEXT;
BEGIN
  -- 1. Detect event
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'active') IN ('active','trialing') THEN
      v_event_name := 'subscription.created';
      v_workflow_key := 'subscription_welcome';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'canceled' THEN
        v_event_name := 'subscription.canceled';
        v_workflow_key := 'subscription_canceled';
      ELSIF NEW.status IN ('past_due','unpaid','payment_failed') THEN
        v_event_name := 'subscription.payment_failed';
        v_workflow_key := 'subscription_payment_failed';
      ELSIF (OLD.status NOT IN ('active','trialing')) AND NEW.status IN ('active','trialing') THEN
        -- Reativação conta como nova boas-vindas
        v_event_name := 'subscription.created';
        v_workflow_key := 'subscription_welcome';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- 2. Find active template for this tenant + key
  SELECT id, template, active INTO v_template
  FROM public.automation_templates
  WHERE tenant_id = NEW.tenant_id AND key = v_workflow_key
  LIMIT 1;

  IF v_template.id IS NULL OR v_template.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 3. Customer & data
  SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = NEW.customer_id;
  IF v_customer.phone IS NULL OR v_customer.phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = NEW.plan_id;
  SELECT COALESCE(business_name, full_name, 'Nossa Barbearia') INTO v_barbershop_name
  FROM public.profiles WHERE id = NEW.tenant_id;

  v_subscription_amount := to_char(COALESCE(v_plan.monthly_price, 0), 'FM999G990D00');
  v_renewal_date := to_char(COALESCE(NEW.next_billing_at, NEW.current_period_end) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  v_idem := 'sub_' || v_workflow_key || '_' || NEW.id::text || '_' || COALESCE(NEW.status,'-');

  -- 4. Enqueue
  BEGIN
    INSERT INTO public.automation_queue (
      tenant_id, automation_id, customer_id, automation_type, workflow_key,
      event_name, status, scheduled_for, attempts, idempotency_key, payload
    ) VALUES (
      NEW.tenant_id, v_template.id, NEW.customer_id, v_workflow_key, v_workflow_key,
      v_event_name, 'pending', now(), 0, v_idem,
      jsonb_build_object(
        'customer_name', COALESCE(v_customer.name, 'Cliente'),
        'barbershop_name', v_barbershop_name,
        'subscription_plan', COALESCE(v_plan.name, 'Plano'),
        'subscription_amount', v_subscription_amount,
        'renewal_date', v_renewal_date,
        'subscription_id', NEW.id,
        'rendered', v_template.template
      )
    ) ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_subscription_automation enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 2) Attach trigger
DROP TRIGGER IF EXISTS trg_customer_subscription_automation ON public.customer_subscriptions;
CREATE TRIGGER trg_customer_subscription_automation
AFTER INSERT OR UPDATE OF status ON public.customer_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trigger_subscription_automation();

-- 3) Function called by cron to enqueue renewal reminders 3 days before
CREATE OR REPLACE FUNCTION public.enqueue_subscription_renewal_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub RECORD;
  v_template RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_barbershop_name TEXT;
  v_idem TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.*
    FROM public.customer_subscriptions cs
    WHERE cs.status IN ('active','trialing')
      AND cs.auto_renew = true
      AND cs.next_billing_at IS NOT NULL
      AND cs.next_billing_at::date = (CURRENT_DATE + INTERVAL '3 days')::date
  LOOP
    SELECT id, template, active INTO v_template
    FROM public.automation_templates
    WHERE tenant_id = v_sub.tenant_id AND key = 'subscription_renewal_upcoming'
    LIMIT 1;
    CONTINUE WHEN v_template.id IS NULL OR v_template.active IS NOT TRUE;

    SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = v_sub.customer_id;
    CONTINUE WHEN v_customer.phone IS NULL OR v_customer.phone = '';

    SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
    SELECT COALESCE(business_name, full_name, 'Nossa Barbearia') INTO v_barbershop_name
    FROM public.profiles WHERE id = v_sub.tenant_id;

    v_idem := 'sub_renewal_' || v_sub.id::text || '_' || to_char(v_sub.next_billing_at, 'YYYYMMDD');

    BEGIN
      INSERT INTO public.automation_queue (
        tenant_id, automation_id, customer_id, automation_type, workflow_key,
        event_name, status, scheduled_for, attempts, idempotency_key, payload
      ) VALUES (
        v_sub.tenant_id, v_template.id, v_sub.customer_id,
        'subscription_renewal_upcoming', 'subscription_renewal_upcoming',
        'subscription.renewal_upcoming', 'pending', now(), 0, v_idem,
        jsonb_build_object(
          'customer_name', COALESCE(v_customer.name, 'Cliente'),
          'barbershop_name', v_barbershop_name,
          'subscription_plan', COALESCE(v_plan.name, 'Plano'),
          'subscription_amount', to_char(COALESCE(v_plan.monthly_price, 0), 'FM999G990D00'),
          'renewal_date', to_char(v_sub.next_billing_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
          'subscription_id', v_sub.id,
          'rendered', v_template.template
        )
      ) ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enqueue_subscription_renewal_reminders failed for %: %', v_sub.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 4) Schedule the renewal reminder check daily at 12:00 UTC (~09:00 BRT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'subscription-renewal-reminders-daily') THEN
    PERFORM cron.unschedule('subscription-renewal-reminders-daily');
  END IF;
  PERFORM cron.schedule(
    'subscription-renewal-reminders-daily',
    '0 12 * * *',
    $cron$ SELECT public.enqueue_subscription_renewal_reminders(); $cron$
  );
END $$;
