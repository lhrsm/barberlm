
-- 1) Trigger INSERT: cria log 'reserved' assim que o agendamento com benefício é criado
CREATE OR REPLACE FUNCTION public.reserve_usage_log_on_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_name text;
  v_qty integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF NEW.subscription_id IS NOT NULL
     AND COALESCE(NEW.subscription_covered_amount, 0) > 0
     AND COALESCE(NEW.status, '') NOT IN ('cancelled','canceled','no_show') THEN

    SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
    v_qty := public._compute_consume_quantity(v_service_name);

    SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
      FROM public.customer_subscriptions WHERE id = NEW.subscription_id;

    INSERT INTO public.subscription_usage_logs (
      tenant_id, subscription_id, customer_id, appointment_id, service_id,
      benefit_type, covered_amount, extra_amount, consume_quantity,
      status, used_at, period_start, period_end
    ) VALUES (
      NEW.tenant_id, NEW.subscription_id, NEW.customer_id, NEW.id, NEW.service_id,
      'service',
      COALESCE(NEW.subscription_covered_amount, 0),
      GREATEST(0, COALESCE(NEW.total_price, 0) - COALESCE(NEW.subscription_covered_amount, 0)),
      v_qty,
      CASE WHEN NEW.status = 'completed' THEN 'consumed' ELSE 'reserved' END,
      COALESCE(NEW.start_time, now()),
      v_period_start, v_period_end
    )
    ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
    DO UPDATE SET
      consume_quantity = GREATEST(public.subscription_usage_logs.consume_quantity, EXCLUDED.consume_quantity),
      covered_amount = EXCLUDED.covered_amount,
      extra_amount = EXCLUDED.extra_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_reserve_usage_log_on_insert ON public.appointments;
CREATE TRIGGER tr_reserve_usage_log_on_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.reserve_usage_log_on_appointment_insert();

-- 2) Backfill: cria logs 'reserved' faltantes para agendamentos futuros/atuais com benefício
INSERT INTO public.subscription_usage_logs (
  tenant_id, subscription_id, customer_id, appointment_id, service_id,
  benefit_type, covered_amount, extra_amount, consume_quantity,
  status, used_at, period_start, period_end
)
SELECT
  a.tenant_id, a.subscription_id, a.customer_id, a.id, a.service_id,
  'service',
  COALESCE(a.subscription_covered_amount, 0),
  GREATEST(0, COALESCE(a.total_price, 0) - COALESCE(a.subscription_covered_amount, 0)),
  public._compute_consume_quantity(s.name),
  CASE WHEN a.status = 'completed' THEN 'consumed' ELSE 'reserved' END,
  COALESCE(a.start_time, now()),
  cs.current_period_start, cs.current_period_end
FROM public.appointments a
LEFT JOIN public.services s ON s.id = a.service_id
LEFT JOIN public.customer_subscriptions cs ON cs.id = a.subscription_id
WHERE a.subscription_id IS NOT NULL
  AND COALESCE(a.subscription_covered_amount, 0) > 0
  AND a.status NOT IN ('cancelled','canceled','no_show')
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_usage_logs l WHERE l.appointment_id = a.id
  );

-- 3) Corrige consume_quantity de logs existentes onde o serviço é combo mas gravou 1
UPDATE public.subscription_usage_logs l
SET consume_quantity = public._compute_consume_quantity(s.name)
FROM public.services s
WHERE l.service_id = s.id
  AND l.consume_quantity < public._compute_consume_quantity(s.name)
  AND l.status IN ('reserved','consumed');
