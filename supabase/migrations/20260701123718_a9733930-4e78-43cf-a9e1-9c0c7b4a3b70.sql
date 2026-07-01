
-- Helper: normalize (lower + strip common PT accents) without unaccent extension
CREATE OR REPLACE FUNCTION public._norm_pt(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(translate(COALESCE(_txt,''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));
$$;

CREATE OR REPLACE FUNCTION public._compute_consume_quantity(_service_name text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _service_name IS NULL THEN 1
    WHEN public._norm_pt(_service_name) LIKE '%combo%' THEN 2
    WHEN public._norm_pt(_service_name) LIKE '%barba%'
      AND (public._norm_pt(_service_name) LIKE '%corte%'
        OR public._norm_pt(_service_name) LIKE '%cabelo%') THEN 2
    ELSE 1
  END;
$$;

-- 1. Backfill missing usage logs
INSERT INTO public.subscription_usage_logs (
  tenant_id, subscription_id, customer_id, appointment_id, service_id,
  benefit_type, covered_amount, extra_amount, consume_quantity, status, used_at, period_start, period_end
)
SELECT
  a.tenant_id, a.subscription_id, a.customer_id, a.id, a.service_id,
  'service',
  COALESCE(a.subscription_covered_amount, 0),
  GREATEST(0, COALESCE(a.total_price,0) - COALESCE(a.subscription_covered_amount,0)),
  public._compute_consume_quantity(s.name),
  'consumed',
  COALESCE(a.completed_at, a.updated_at, now()),
  cs.current_period_start,
  cs.current_period_end
FROM public.appointments a
LEFT JOIN public.services s ON s.id = a.service_id
LEFT JOIN public.customer_subscriptions cs ON cs.id = a.subscription_id
WHERE a.subscription_id IS NOT NULL
  AND a.status = 'completed'
  AND COALESCE(a.subscription_covered_amount,0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.subscription_usage_logs u WHERE u.appointment_id = a.id);

-- 2. Fix existing consumed logs where quantity is wrong for combos
UPDATE public.subscription_usage_logs u
SET consume_quantity = public._compute_consume_quantity(s.name)
FROM public.appointments a
LEFT JOIN public.services s ON s.id = a.service_id
WHERE u.appointment_id = a.id
  AND u.status = 'consumed'
  AND COALESCE(u.consume_quantity,1) <> public._compute_consume_quantity(s.name);

-- 3. Unique index on appointment_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_usage_logs_appointment
  ON public.subscription_usage_logs (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- 4. Trigger: UPSERT log on completion
CREATE OR REPLACE FUNCTION public.sync_usage_logs_on_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_service_name text;
  v_qty integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed'
       AND NEW.subscription_id IS NOT NULL
       AND COALESCE(NEW.subscription_covered_amount,0) > 0 THEN

      SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
      v_qty := public._compute_consume_quantity(v_service_name);
      SELECT current_period_start, current_period_end INTO v_period_start, v_period_end
        FROM public.customer_subscriptions WHERE id = NEW.subscription_id;

      INSERT INTO public.subscription_usage_logs (
        tenant_id, subscription_id, customer_id, appointment_id, service_id,
        benefit_type, covered_amount, extra_amount, consume_quantity, status, used_at, period_start, period_end
      ) VALUES (
        NEW.tenant_id, NEW.subscription_id, NEW.customer_id, NEW.id, NEW.service_id,
        'service',
        COALESCE(NEW.subscription_covered_amount,0),
        GREATEST(0, COALESCE(NEW.total_price,0) - COALESCE(NEW.subscription_covered_amount,0)),
        v_qty,
        'consumed',
        COALESCE(NEW.completed_at, now()),
        v_period_start, v_period_end
      )
      ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
      DO UPDATE SET
        status = 'consumed',
        used_at = COALESCE(public.subscription_usage_logs.used_at, EXCLUDED.used_at),
        consume_quantity = GREATEST(public.subscription_usage_logs.consume_quantity, EXCLUDED.consume_quantity),
        covered_amount = EXCLUDED.covered_amount,
        extra_amount = EXCLUDED.extra_amount;

    ELSIF NEW.status IN ('canceled','cancelled','no_show') THEN
      UPDATE public.subscription_usage_logs
         SET status = 'cancelled'
       WHERE appointment_id = NEW.id AND status IN ('reserved','consumed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
