
-- =========================================================
-- 1) subscription_plans: novas colunas
-- =========================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS participates_traditional_loyalty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS participates_cashback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accumulates_premium_loyalty boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_product_discount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agenda_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusive_hours boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusive_days boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferential_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS barber_commission_type text NOT NULL DEFAULT 'fixed'
    CHECK (barber_commission_type IN ('fixed','percent','custom','none')),
  ADD COLUMN IF NOT EXISTS barber_commission_value numeric(10,2) NOT NULL DEFAULT 0;

-- =========================================================
-- 2) subscription_loyalty_rewards
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscription_loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  months_required integer NOT NULL CHECK (months_required > 0),
  reward_type text NOT NULL CHECK (reward_type IN ('free_service','cashback','credit','product','discount','custom')),
  reward_value numeric(10,2) NOT NULL DEFAULT 0,
  reward_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, months_required, reward_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_loyalty_rewards TO authenticated;
GRANT ALL ON public.subscription_loyalty_rewards TO service_role;

ALTER TABLE public.subscription_loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own rewards" ON public.subscription_loyalty_rewards
  FOR ALL TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_sub_loyalty_rewards_tenant ON public.subscription_loyalty_rewards(tenant_id);

CREATE TRIGGER trg_sub_loyalty_rewards_updated_at
  BEFORE UPDATE ON public.subscription_loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) subscription_loyalty_history
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscription_loyalty_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.subscription_loyalty_rewards(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','redeemed','expired','cancelled')),
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, reward_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_loyalty_history TO authenticated;
GRANT ALL ON public.subscription_loyalty_history TO service_role;

ALTER TABLE public.subscription_loyalty_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own history" ON public.subscription_loyalty_history
  FOR ALL TO authenticated
  USING ((tenant_id = auth.uid()) OR is_super_admin_user())
  WITH CHECK ((tenant_id = auth.uid()) OR is_super_admin_user());

CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_tenant ON public.subscription_loyalty_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_customer ON public.subscription_loyalty_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_loyalty_history_subscription ON public.subscription_loyalty_history(subscription_id);

CREATE TRIGGER trg_sub_loyalty_history_updated_at
  BEFORE UPDATE ON public.subscription_loyalty_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_active_subscriber(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_subscriptions
    WHERE customer_id = p_customer_id
      AND status IN ('active','trialing','past_due')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_subscription(p_customer_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  plan_id uuid,
  tenant_id uuid,
  started_at timestamptz,
  months_active integer,
  participates_traditional_loyalty boolean,
  participates_cashback boolean,
  accumulates_premium_loyalty boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id,
    cs.plan_id,
    cs.tenant_id,
    cs.started_at,
    GREATEST(0, EXTRACT(YEAR FROM age(now(), cs.started_at))::int * 12
            + EXTRACT(MONTH FROM age(now(), cs.started_at))::int) AS months_active,
    sp.participates_traditional_loyalty,
    sp.participates_cashback,
    sp.accumulates_premium_loyalty
  FROM public.customer_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.customer_id = p_customer_id
    AND cs.status IN ('active','trialing','past_due')
  ORDER BY cs.started_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_subscriber_months(p_subscription_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0,
    EXTRACT(YEAR FROM age(now(), started_at))::int * 12
    + EXTRACT(MONTH FROM age(now(), started_at))::int
  )
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id;
$$;

-- =========================================================
-- 5) grant_subscription_rewards (cron diário)
-- =========================================================
CREATE OR REPLACE FUNCTION public.grant_subscription_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_months int;
  v_granted int := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.tenant_id, cs.customer_id, cs.plan_id
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.status IN ('active','trialing')
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := public.get_subscriber_months(v_sub.id);

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = v_sub.tenant_id
        AND active = true
        AND months_required <= v_months
    LOOP
      INSERT INTO public.subscription_loyalty_history (
        tenant_id, subscription_id, customer_id, reward_id, status
      ) VALUES (
        v_sub.tenant_id, v_sub.id, v_sub.customer_id, v_reward.id, 'granted'
      )
      ON CONFLICT (subscription_id, reward_id) DO NOTHING;

      IF FOUND THEN
        v_granted := v_granted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_granted;
END;
$$;

-- =========================================================
-- 6) Schedule cron diário (10:00 UTC)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('grant-subscription-rewards-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grant-subscription-rewards-daily');

    PERFORM cron.schedule(
      'grant-subscription-rewards-daily',
      '0 10 * * *',
      $cron$ SELECT public.grant_subscription_rewards(); $cron$
    );
  END IF;
END $$;

-- =========================================================
-- 7) Ajustar complete_appointment para bloquear dupla bonificação
-- =========================================================
CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text DEFAULT 'admin'::text, p_changed_by_id uuid DEFAULT auth.uid(), p_source text DEFAULT 'system'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_customer_id UUID;
    v_tenant_id UUID;
    v_old_status TEXT;
    v_loyalty_mode TEXT;
    v_sub RECORD;
    v_block_cashback BOOLEAN := false;
BEGIN
    SELECT * FROM public.appointments WHERE id = p_appointment_id INTO v_appt;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_customer_id := v_appt.customer_id;
    v_tenant_id   := v_appt.tenant_id;
    v_old_status  := COALESCE(v_appt.status, 'scheduled');

    SELECT * FROM public.profiles WHERE id = v_tenant_id INTO v_tenant;
    v_loyalty_mode := COALESCE(v_tenant.loyalty_mode, 'none');

    -- NOVO: Verificar se é assinante ativo e se o plano bloqueia cashback
    SELECT * INTO v_sub FROM public.get_active_subscription(v_customer_id);
    IF FOUND AND v_sub.participates_cashback = false THEN
      v_block_cashback := true;
    END IF;

    v_total_price   := COALESCE(v_appt.total_price, 0);
    v_credit_used   := COALESCE((p_metadata->>'credits_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount    := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount   := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount   := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric,
        (p_metadata->>'debit_card_amount')::numeric,
        v_appt.credit_card_amount, v_appt.debit_card_amount, 0
    );

    IF (v_pix_amount + v_cash_amount + v_card_amount) = 0 AND v_total_price > 0 THEN
        v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used);
        v_pix_amount := v_final_amount;
    ELSE
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    END IF;

    UPDATE public.appointments
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        completed_by = COALESCE(completed_by, p_changed_by_id::text),
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        credits_used = v_credit_used,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        final_amount = v_final_amount,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    INSERT INTO public.transactions (
        user_id, tenant_id, appointment_id, barber_id, type, category,
        amount, pix_amount, cash_amount, credit_card_amount,
        credits_amount, cashback_amount, payment_method,
        description, date, payment_breakdown
    ) VALUES (
        v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
        v_total_price, v_pix_amount, v_cash_amount, v_card_amount,
        v_credit_used, v_cashback_used,
        COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'mixed'),
        'Conclusão: ' || p_appointment_id::text, CURRENT_DATE,
        jsonb_build_object('pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount, 'credits', v_credit_used, 'cashback', v_cashback_used)
    )
    ON CONFLICT (appointment_id) WHERE type = 'income' AND appointment_id IS NOT NULL
    DO UPDATE SET
        amount = EXCLUDED.amount,
        pix_amount = EXCLUDED.pix_amount,
        cash_amount = EXCLUDED.cash_amount,
        credit_card_amount = EXCLUDED.credit_card_amount,
        credits_amount = EXCLUDED.credits_amount,
        cashback_amount = EXCLUDED.cashback_amount,
        payment_method = EXCLUDED.payment_method,
        payment_breakdown = EXCLUDED.payment_breakdown,
        updated_at = NOW();

    -- Cashback: bloqueado para assinantes cujo plano opta por não participar
    IF NOT v_block_cashback
       AND v_loyalty_mode = 'cashback'
       AND COALESCE(v_tenant.cashback_enabled, false) = true THEN
        v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
        IF v_cashback_percentage > 0 AND v_final_amount > 0 THEN
            v_cashback_earned := (v_final_amount * v_cashback_percentage) / 100;
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_tenant_id, v_customer_id, p_appointment_id, v_cashback_earned, 'earned', 'Cashback sobre serviço'
            )
            ON CONFLICT (appointment_id) DO UPDATE SET amount = EXCLUDED.amount;
            UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
        END IF;
    ELSE
        DELETE FROM public.cashback_transactions
         WHERE appointment_id = p_appointment_id AND type IN ('earned','cashback_earned');
        UPDATE public.appointments SET cashback_earned = 0 WHERE id = p_appointment_id;
    END IF;

    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, 'used', v_credit_used, 'Uso de crédito em agendamento'
        )
        ON CONFLICT (appointment_id) WHERE type IN ('used','credit_used') AND appointment_id IS NOT NULL
        DO UPDATE SET amount = EXCLUDED.amount;
    END IF;

    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_old_status, 'completed', v_old_status, 'completed',
        COALESCE(p_changed_by_type,'admin'), p_changed_by_id, COALESCE(p_source,'system'),
        COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('loyalty_mode', v_loyalty_mode, 'is_subscriber', v_block_cashback)
    );

    PERFORM public.recalculate_customer_credit_balance(v_customer_id);
    PERFORM public.recalculate_customer_cashback_balance(v_customer_id);

    RETURN jsonb_build_object(
      'success', true,
      'appointment_id', p_appointment_id,
      'loyalty_mode', v_loyalty_mode,
      'cashback_earned', v_cashback_earned,
      'subscriber_blocked', v_block_cashback
    );
END;
$function$;

-- =========================================================
-- 8) Bloquear loyalty_points para assinantes cujo plano opta por não participar
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_recalculate_customer_loyalty(p_customer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_points INTEGER;
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM public.get_active_subscription(p_customer_id);

    -- Se assinante ativo e plano não participa da fidelidade tradicional, zera pontos
    IF FOUND AND v_sub.participates_traditional_loyalty = false THEN
      UPDATE public.customers
      SET loyalty_points = 0, updated_at = NOW()
      WHERE id = p_customer_id;
      RETURN 0;
    END IF;

    SELECT COUNT(*)
    INTO v_points
    FROM public.appointments
    WHERE customer_id = p_customer_id AND status = 'completed';

    UPDATE public.customers
    SET loyalty_points = v_points,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN v_points;
END;
$function$;
