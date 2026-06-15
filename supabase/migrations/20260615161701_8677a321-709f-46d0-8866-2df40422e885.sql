
-- Function to process loyalty rewards for all active subscriptions of a tenant.
-- Grants rewards whose months_required is met and not yet granted for the subscription.
CREATE OR REPLACE FUNCTION public.process_subscription_loyalty_rewards(p_tenant_id uuid)
RETURNS TABLE(granted_count integer, subscription_id uuid, reward_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_months integer;
  v_count integer := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.customer_id, cs.tenant_id, cs.plan_id,
           COALESCE(cs.started_at, cs.created_at) AS start_date,
           sp.accumulates_premium_loyalty
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.tenant_id = p_tenant_id
      AND cs.status = 'active'
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := GREATEST(0, EXTRACT(YEAR FROM age(now(), v_sub.start_date))::int * 12
                          + EXTRACT(MONTH FROM age(now(), v_sub.start_date))::int);

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = p_tenant_id
        AND active = true
        AND months_required <= v_months
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.subscription_loyalty_history
        WHERE subscription_id = v_sub.id AND reward_id = v_reward.id
      ) THEN
        INSERT INTO public.subscription_loyalty_history
          (tenant_id, customer_id, subscription_id, reward_id, status, granted_at)
        VALUES
          (p_tenant_id, v_sub.customer_id, v_sub.id, v_reward.id, 'granted', now());
        v_count := v_count + 1;
        granted_count := v_count;
        subscription_id := v_sub.id;
        reward_id := v_reward.id;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_subscription_loyalty_rewards(uuid) TO authenticated, service_role;

-- Function to redeem a granted reward
CREATE OR REPLACE FUNCTION public.redeem_subscription_reward(p_history_id uuid, p_notes text DEFAULT NULL)
RETURNS public.subscription_loyalty_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_loyalty_history;
BEGIN
  UPDATE public.subscription_loyalty_history
  SET status = 'redeemed',
      redeemed_at = now(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_history_id AND status = 'granted'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Recompensa não encontrada ou já resgatada';
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_subscription_reward(uuid, text) TO authenticated, service_role;
