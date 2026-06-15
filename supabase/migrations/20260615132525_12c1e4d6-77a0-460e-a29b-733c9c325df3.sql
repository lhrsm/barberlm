
-- ============================================================
-- Loyalty module rewrite
-- - Loyalty belongs to the BARBERSHOP (any barber counts)
-- - Configurable reward (free service / % discount / fixed discount / free addon)
-- - Mutually exclusive with cashback (enabling loyalty disables cashback)
-- - Barber commission is unaffected; cost is absorbed by the barbershop
-- ============================================================

-- 1) loyalty_settings: one row per barbershop
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    appointments_required INTEGER NOT NULL DEFAULT 10 CHECK (appointments_required >= 1),
    benefit_type TEXT NOT NULL DEFAULT 'free_service'
        CHECK (benefit_type IN ('free_service','percent_discount','fixed_discount','free_addon')),
    benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    benefit_description TEXT NOT NULL DEFAULT 'Serviço grátis',
    max_benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    validity_days INTEGER NOT NULL DEFAULT 0 CHECK (validity_days >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
GRANT SELECT ON public.loyalty_settings TO anon; -- portal do cliente exibe regra vigente

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own loyalty settings"
ON public.loyalty_settings FOR ALL
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "public can read loyalty settings"
ON public.loyalty_settings FOR SELECT
TO anon
USING (true);

-- 2) loyalty_rewards: generated and redeemed rewards
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available','redeemed','expired','canceled')),
    appointments_count INTEGER NOT NULL,
    benefit_type TEXT NOT NULL,
    benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    benefit_description TEXT NOT NULL DEFAULT '',
    max_benefit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    redeemed_appointment_id UUID,
    barbershop_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant ON public.loyalty_rewards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_customer ON public.loyalty_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_status ON public.loyalty_rewards(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT ALL ON public.loyalty_rewards TO service_role;
GRANT SELECT ON public.loyalty_rewards TO anon; -- portal do cliente (filtra via customer_id)

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manages own loyalty rewards"
ON public.loyalty_rewards FOR ALL
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "public can read loyalty rewards"
ON public.loyalty_rewards FOR SELECT
TO anon
USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_loyalty_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_loyalty_settings_updated_at ON public.loyalty_settings;
CREATE TRIGGER trg_loyalty_settings_updated_at
BEFORE UPDATE ON public.loyalty_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_touch_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_rewards_updated_at ON public.loyalty_rewards;
CREATE TRIGGER trg_loyalty_rewards_updated_at
BEFORE UPDATE ON public.loyalty_rewards
FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_touch_updated_at();

-- 3) Seed loyalty_settings from existing profiles (free_service_threshold)
INSERT INTO public.loyalty_settings (tenant_id, enabled, appointments_required, benefit_type, benefit_description)
SELECT
  p.id,
  (COALESCE(p.loyalty_mode,'none') = 'loyalty'),
  COALESCE(p.free_service_threshold, 10),
  'free_service',
  'Serviço grátis'
FROM public.profiles p
ON CONFLICT (tenant_id) DO NOTHING;

-- 4) Rewrite handle_appointment_completion to use loyalty_settings
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_loyalty RECORD;
    v_loyalty_count INTEGER;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- Only act when loyalty mode is loyalty AND loyalty_settings says enabled
        IF COALESCE(v_profile.loyalty_mode, 'none') = 'loyalty' THEN
            SELECT * INTO v_loyalty FROM public.loyalty_settings WHERE tenant_id = NEW.tenant_id;

            IF v_loyalty.id IS NOT NULL AND v_loyalty.enabled = true THEN
                -- Increment rolling counter on the customer
                UPDATE public.customers
                SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
                    updated_at = NOW()
                WHERE id = NEW.customer_id
                RETURNING loyalty_points INTO v_loyalty_count;

                IF v_loyalty_count >= v_loyalty.appointments_required THEN
                    UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;

                    v_expires_at := CASE
                        WHEN v_loyalty.validity_days > 0
                            THEN now() + (v_loyalty.validity_days || ' days')::interval
                        ELSE NULL
                    END;

                    INSERT INTO public.loyalty_rewards (
                        tenant_id, customer_id, status, appointments_count,
                        benefit_type, benefit_value, benefit_description,
                        max_benefit_value, earned_at, expires_at
                    ) VALUES (
                        NEW.tenant_id, NEW.customer_id, 'available', v_loyalty.appointments_required,
                        v_loyalty.benefit_type, v_loyalty.benefit_value, v_loyalty.benefit_description,
                        v_loyalty.max_benefit_value, now(), v_expires_at
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 5) Manual redeem RPC (records barbershop_cost, does NOT touch commission)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
    p_reward_id UUID,
    p_appointment_id UUID,
    p_applied_cost NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward RECORD;
    v_cost NUMERIC(10,2);
BEGIN
    SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
    IF v_reward.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'reward_not_found');
    END IF;
    IF v_reward.status <> 'available' THEN
        RETURN jsonb_build_object('success', false, 'error', 'reward_not_available');
    END IF;
    IF v_reward.expires_at IS NOT NULL AND v_reward.expires_at < now() THEN
        UPDATE public.loyalty_rewards SET status = 'expired' WHERE id = p_reward_id;
        RETURN jsonb_build_object('success', false, 'error', 'reward_expired');
    END IF;

    v_cost := COALESCE(p_applied_cost, 0);
    IF v_reward.max_benefit_value > 0 AND v_cost > v_reward.max_benefit_value THEN
        v_cost := v_reward.max_benefit_value;
    END IF;

    UPDATE public.loyalty_rewards
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_appointment_id = p_appointment_id,
        barbershop_cost = v_cost
    WHERE id = p_reward_id;

    RETURN jsonb_build_object('success', true, 'reward_id', p_reward_id, 'barbershop_cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(UUID, UUID, NUMERIC) TO authenticated, service_role;

-- 6) Expire rewards (called by cron or manually)
CREATE OR REPLACE FUNCTION public.expire_loyalty_rewards()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE public.loyalty_rewards
    SET status = 'expired'
    WHERE status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_loyalty_rewards() TO authenticated, service_role;
