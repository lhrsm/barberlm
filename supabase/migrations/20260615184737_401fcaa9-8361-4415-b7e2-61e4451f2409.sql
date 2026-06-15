
-- 1) Novas colunas no histórico
ALTER TABLE public.subscription_loyalty_history
  ADD COLUMN IF NOT EXISTS reward_cycle integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reward_description text,
  ADD COLUMN IF NOT EXISTS notification_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_error text;

-- 2) Atualiza constraint de unicidade: cliente não recebe a mesma recompensa duas vezes no mesmo ciclo
ALTER TABLE public.subscription_loyalty_history
  DROP CONSTRAINT IF EXISTS subscription_loyalty_history_subscription_id_reward_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_loyalty_history_unique_cycle'
  ) THEN
    ALTER TABLE public.subscription_loyalty_history
      ADD CONSTRAINT subscription_loyalty_history_unique_cycle
      UNIQUE (tenant_id, customer_id, subscription_id, reward_id, reward_cycle);
  END IF;
END $$;

-- 3) Seed do template WhatsApp para o evento subscription_reward_unlocked
CREATE OR REPLACE FUNCTION public.seed_subscription_reward_unlocked_template(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.automation_templates (tenant_id, key, name, channel, trigger_event, template, active, requires_callback)
  VALUES (
    p_tenant_id,
    'subscription_reward_unlocked',
    'Recompensa Premium Desbloqueada',
    'whatsapp',
    'subscription.reward_unlocked',
    E'Olá {{customer_name}} 🎉\n\nParabéns! Você desbloqueou uma nova recompensa da sua assinatura premium na {{barbershop_name}}.\n\n🎁 Recompensa: {{reward_description}}\n\nContinue aproveitando seus benefícios exclusivos como assinante!',
    true,
    false
  )
  ON CONFLICT (tenant_id, key) DO UPDATE
    SET trigger_event = EXCLUDED.trigger_event,
        channel = EXCLUDED.channel,
        requires_callback = false,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_subscription_reward_unlocked_template(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_subscription_reward_unlocked_template(r.id);
  END LOOP;
END $$;

-- 4) Rotina principal: roda para TODOS os tenants, libera recompensas elegíveis e enfileira WhatsApp
CREATE OR REPLACE FUNCTION public.process_subscription_loyalty_rewards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_reward RECORD;
  v_customer RECORD;
  v_plan RECORD;
  v_template RECORD;
  v_barbershop_name TEXT;
  v_months int;
  v_cycle int;
  v_history_id uuid;
  v_idem text;
  v_granted int := 0;
  v_notified int := 0;
  v_errors int := 0;
BEGIN
  FOR v_sub IN
    SELECT cs.id, cs.tenant_id, cs.customer_id, cs.plan_id,
           COALESCE(cs.started_at, cs.created_at) AS start_date
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.status IN ('active','trialing')
      AND sp.accumulates_premium_loyalty = true
  LOOP
    v_months := GREATEST(0,
      EXTRACT(YEAR FROM age(now(), v_sub.start_date))::int * 12
      + EXTRACT(MONTH FROM age(now(), v_sub.start_date))::int
    );
    -- Ciclo: 1 por instância de assinatura (subscription_id já isola ciclos)
    v_cycle := 1;

    FOR v_reward IN
      SELECT * FROM public.subscription_loyalty_rewards
      WHERE tenant_id = v_sub.tenant_id
        AND active = true
        AND months_required <= v_months
      ORDER BY months_required ASC
    LOOP
      -- Insere histórico (idempotente via unique constraint)
      INSERT INTO public.subscription_loyalty_history (
        tenant_id, customer_id, subscription_id, reward_id,
        reward_cycle, reward_description, status, granted_at
      ) VALUES (
        v_sub.tenant_id, v_sub.customer_id, v_sub.id, v_reward.id,
        v_cycle, v_reward.description, 'granted', now()
      )
      ON CONFLICT (tenant_id, customer_id, subscription_id, reward_id, reward_cycle) DO NOTHING
      RETURNING id INTO v_history_id;

      IF v_history_id IS NULL THEN
        CONTINUE; -- já existia, não duplica nem notifica
      END IF;

      v_granted := v_granted + 1;

      -- Enfileira WhatsApp (Motor V2)
      BEGIN
        SELECT id, template, active INTO v_template
        FROM public.automation_templates
        WHERE tenant_id = v_sub.tenant_id AND key = 'subscription_reward_unlocked'
        LIMIT 1;

        IF v_template.id IS NULL OR v_template.active IS NOT TRUE THEN
          UPDATE public.subscription_loyalty_history
          SET notification_error = 'template_not_found_or_inactive'
          WHERE id = v_history_id;
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = v_sub.customer_id;
        IF v_customer.phone IS NULL OR v_customer.phone = '' THEN
          UPDATE public.subscription_loyalty_history
          SET notification_error = 'missing_customer_phone'
          WHERE id = v_history_id;
          v_errors := v_errors + 1;
          CONTINUE;
        END IF;

        SELECT name, monthly_price INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
        SELECT COALESCE(business_name, full_name, 'Nossa Barbearia') INTO v_barbershop_name
        FROM public.profiles WHERE id = v_sub.tenant_id;

        v_idem := 'sub_reward_' || v_history_id::text;

        INSERT INTO public.automation_queue (
          tenant_id, automation_id, customer_id, automation_type, workflow_key,
          event_name, status, scheduled_for, attempts, idempotency_key, payload
        ) VALUES (
          v_sub.tenant_id, v_template.id, v_sub.customer_id,
          'subscription_reward_unlocked', 'subscription_reward_unlocked',
          'subscription.reward_unlocked', 'pending', now(), 0, v_idem,
          jsonb_build_object(
            'customer_name', COALESCE(v_customer.name, 'Cliente'),
            'barbershop_name', v_barbershop_name,
            'plan_name', COALESCE(v_plan.name, 'Plano'),
            'reward_description', v_reward.description,
            'tenure_months', v_months,
            'subscription_id', v_sub.id,
            'reward_id', v_reward.id,
            'history_id', v_history_id,
            'reward_cycle', v_cycle,
            'rendered', v_template.template
          )
        )
        ON CONFLICT (idempotency_key) WHERE status <> 'error' DO NOTHING;

        UPDATE public.subscription_loyalty_history
        SET notification_sent = true,
            notification_sent_at = now(),
            notification_error = NULL
        WHERE id = v_history_id;

        v_notified := v_notified + 1;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.subscription_loyalty_history
        SET notification_error = SQLERRM
        WHERE id = v_history_id;
        v_errors := v_errors + 1;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'granted', v_granted,
    'notified', v_notified,
    'errors', v_errors,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_subscription_loyalty_rewards() TO authenticated, service_role;

-- 5) Agendamento diário às 09:00 America/Sao_Paulo (= 12:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grant-subscription-rewards-daily') THEN
      PERFORM cron.unschedule('grant-subscription-rewards-daily');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-subscription-loyalty-rewards-daily') THEN
      PERFORM cron.unschedule('process-subscription-loyalty-rewards-daily');
    END IF;
    PERFORM cron.schedule(
      'process-subscription-loyalty-rewards-daily',
      '0 12 * * *',
      $cron$ SELECT public.process_subscription_loyalty_rewards(); $cron$
    );
  END IF;
END $$;
