
-- =====================================================================
-- 1. subscription_plan_benefits
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plan_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  benefit_key text NOT NULL,
  benefit_name text NOT NULL,
  monthly_limit integer NOT NULL CHECK (monthly_limit >= 0),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, benefit_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_benefits TO authenticated;
GRANT SELECT ON public.subscription_plan_benefits TO anon;
GRANT ALL ON public.subscription_plan_benefits TO service_role;

ALTER TABLE public.subscription_plan_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can view plan benefits" ON public.subscription_plan_benefits
  FOR SELECT TO anon USING (active = true);

CREATE POLICY "auth can view plan benefits" ON public.subscription_plan_benefits
  FOR SELECT TO authenticated USING (active = true OR tenant_id = auth.uid() OR is_super_admin_user());

CREATE POLICY "tenant manages own plan benefits" ON public.subscription_plan_benefits
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_spb_plan ON public.subscription_plan_benefits(plan_id);
CREATE INDEX IF NOT EXISTS idx_spb_tenant ON public.subscription_plan_benefits(tenant_id);

CREATE TRIGGER trg_spb_updated_at BEFORE UPDATE ON public.subscription_plan_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. subscription_plan_benefit_services
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plan_benefit_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  benefit_id uuid NOT NULL REFERENCES public.subscription_plan_benefits(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  consume_quantity integer NOT NULL DEFAULT 1 CHECK (consume_quantity > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (benefit_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_benefit_services TO authenticated;
GRANT SELECT ON public.subscription_plan_benefit_services TO anon;
GRANT ALL ON public.subscription_plan_benefit_services TO service_role;

ALTER TABLE public.subscription_plan_benefit_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can view plan benefit services" ON public.subscription_plan_benefit_services
  FOR SELECT TO anon USING (active = true);

CREATE POLICY "auth can view plan benefit services" ON public.subscription_plan_benefit_services
  FOR SELECT TO authenticated USING (active = true OR tenant_id = auth.uid() OR is_super_admin_user());

CREATE POLICY "tenant manages own plan benefit services" ON public.subscription_plan_benefit_services
  FOR ALL TO authenticated
  USING (tenant_id = auth.uid() OR is_super_admin_user())
  WITH CHECK (tenant_id = auth.uid() OR is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_spbs_plan ON public.subscription_plan_benefit_services(plan_id);
CREATE INDEX IF NOT EXISTS idx_spbs_benefit ON public.subscription_plan_benefit_services(benefit_id);
CREATE INDEX IF NOT EXISTS idx_spbs_service ON public.subscription_plan_benefit_services(service_id);
CREATE INDEX IF NOT EXISTS idx_spbs_tenant ON public.subscription_plan_benefit_services(tenant_id);

CREATE TRIGGER trg_spbs_updated_at BEFORE UPDATE ON public.subscription_plan_benefit_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 3. subscription_usage_logs - new fields
-- =====================================================================
ALTER TABLE public.subscription_usage_logs
  ADD COLUMN IF NOT EXISTS benefit_key text,
  ADD COLUMN IF NOT EXISTS consume_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'consumed';

-- Validate status via trigger (not CHECK, to keep things flexible)
CREATE OR REPLACE FUNCTION public.validate_usage_log_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('reserved','consumed','cancelled','refunded') THEN
    RAISE EXCEPTION 'invalid status %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_usage_log_status ON public.subscription_usage_logs;
CREATE TRIGGER trg_validate_usage_log_status
  BEFORE INSERT OR UPDATE ON public.subscription_usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_usage_log_status();

-- Drop the appointment unique index (allow multiple rows per appointment, e.g. combos)
DROP INDEX IF EXISTS public.uq_sub_usage_appointment;
CREATE INDEX IF NOT EXISTS idx_sub_usage_appointment ON public.subscription_usage_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sub_usage_status ON public.subscription_usage_logs(status);

-- =====================================================================
-- 4. get_subscription_benefit_balance
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_subscription_benefit_balance(_subscription_id uuid)
RETURNS TABLE (
  benefit_key text,
  benefit_name text,
  monthly_limit integer,
  used integer,
  remaining integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan_id uuid;
  _period_start timestamptz;
  _period_end timestamptz;
BEGIN
  SELECT cs.plan_id,
         COALESCE(cs.current_period_start, date_trunc('month', now())),
         COALESCE(cs.current_period_end, date_trunc('month', now()) + interval '1 month')
    INTO _plan_id, _period_start, _period_end
  FROM public.customer_subscriptions cs
  WHERE cs.id = _subscription_id;

  IF _plan_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.benefit_key,
    b.benefit_name,
    b.monthly_limit,
    COALESCE(SUM(
      CASE WHEN ul.status IN ('reserved','consumed') THEN ul.consume_quantity ELSE 0 END
    ), 0)::int AS used,
    GREATEST(
      b.monthly_limit - COALESCE(SUM(
        CASE WHEN ul.status IN ('reserved','consumed') THEN ul.consume_quantity ELSE 0 END
      ), 0),
      0
    )::int AS remaining
  FROM public.subscription_plan_benefits b
  LEFT JOIN public.subscription_usage_logs ul
    ON ul.subscription_id = _subscription_id
   AND ul.benefit_key = b.benefit_key
   AND ul.used_at >= _period_start
   AND ul.used_at < _period_end
  WHERE b.plan_id = _plan_id AND b.active = true
  GROUP BY b.benefit_key, b.benefit_name, b.monthly_limit, b.display_order
  ORDER BY b.display_order, b.benefit_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_benefit_balance(uuid) TO anon, authenticated, service_role;

-- =====================================================================
-- 5. consume_subscription_benefits_v2
-- =====================================================================
CREATE OR REPLACE FUNCTION public.consume_subscription_benefits_v2(
  _subscription_id uuid,
  _service_id uuid,
  _appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan_id uuid;
  _tenant_id uuid;
  _customer_id uuid;
  _period_start timestamptz;
  _period_end timestamptz;
  _link record;
  _balance record;
  _missing jsonb := '[]'::jsonb;
  _inserted_ids uuid[] := ARRAY[]::uuid[];
  _new_id uuid;
BEGIN
  SELECT cs.plan_id, cs.tenant_id, cs.customer_id,
         COALESCE(cs.current_period_start, date_trunc('month', now())),
         COALESCE(cs.current_period_end, date_trunc('month', now()) + interval '1 month')
    INTO _plan_id, _tenant_id, _customer_id, _period_start, _period_end
  FROM public.customer_subscriptions cs
  WHERE cs.id = _subscription_id;

  IF _plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_not_found');
  END IF;

  -- Check each benefit the service consumes
  FOR _link IN
    SELECT bs.consume_quantity, b.benefit_key, b.benefit_name, b.id as benefit_id
    FROM public.subscription_plan_benefit_services bs
    JOIN public.subscription_plan_benefits b ON b.id = bs.benefit_id
    WHERE bs.plan_id = _plan_id
      AND bs.service_id = _service_id
      AND bs.active = true
      AND b.active = true
  LOOP
    SELECT remaining INTO _balance
    FROM public.get_subscription_benefit_balance(_subscription_id)
    WHERE benefit_key = _link.benefit_key;

    IF _balance IS NULL OR _balance.remaining < _link.consume_quantity THEN
      _missing := _missing || jsonb_build_object(
        'benefit_key', _link.benefit_key,
        'benefit_name', _link.benefit_name,
        'required', _link.consume_quantity,
        'remaining', COALESCE(_balance.remaining, 0)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(_missing) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'missing', _missing);
  END IF;

  -- Insert reservation logs (one row per benefit)
  FOR _link IN
    SELECT bs.consume_quantity, b.benefit_key
    FROM public.subscription_plan_benefit_services bs
    JOIN public.subscription_plan_benefits b ON b.id = bs.benefit_id
    WHERE bs.plan_id = _plan_id
      AND bs.service_id = _service_id
      AND bs.active = true
      AND b.active = true
  LOOP
    INSERT INTO public.subscription_usage_logs (
      tenant_id, subscription_id, subscription_plan_id, customer_id,
      appointment_id, service_id, benefit_key, consume_quantity,
      status, benefit_type, period_start, period_end
    ) VALUES (
      _tenant_id, _subscription_id, _plan_id, _customer_id,
      _appointment_id, _service_id, _link.benefit_key, _link.consume_quantity,
      'reserved', 'service', _period_start, _period_end
    ) RETURNING id INTO _new_id;
    _inserted_ids := array_append(_inserted_ids, _new_id);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'log_ids', to_jsonb(_inserted_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_subscription_benefits_v2(uuid, uuid, uuid) TO anon, authenticated, service_role;

-- =====================================================================
-- 6. Appointment status -> usage log status sync
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_usage_logs_on_appointment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.subscription_usage_logs
        SET status = 'consumed'
        WHERE appointment_id = NEW.id AND status = 'reserved';
    ELSIF NEW.status IN ('canceled','cancelled','no_show') THEN
      UPDATE public.subscription_usage_logs
        SET status = 'cancelled'
        WHERE appointment_id = NEW.id AND status IN ('reserved','consumed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_refund_subscription_on_cancel ON public.appointments;
DROP TRIGGER IF EXISTS tr_sync_usage_logs_on_status ON public.appointments;
CREATE TRIGGER tr_sync_usage_logs_on_status
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_usage_logs_on_appointment_status();
