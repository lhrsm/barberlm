
-- Seed plans for tenant Barbearia LM
DO $$
DECLARE
  v_tenant uuid := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
BEGIN
  -- Essencial
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE tenant_id = v_tenant AND name = 'Plano Essencial') THEN
    INSERT INTO public.subscription_plans (
      tenant_id, name, description, plan_type, monthly_price, usage_type, max_uses_per_month,
      benefits, included_benefits, display_order, accumulates_premium_loyalty, agenda_priority
    ) VALUES (
      v_tenant, 'Plano Essencial', 'Ideal para quem faz manutenção.', 'hair_beard', 99.90, 'limited', 4,
      '{"haircuts":2,"beards":2}'::jsonb,
      '["Portal Premium","Histórico de atendimentos","Cartão Digital","Agendamento prioritário"]'::jsonb,
      1, true, true
    );
  END IF;

  -- VIP
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE tenant_id = v_tenant AND name = 'Plano Barber VIP') THEN
    INSERT INTO public.subscription_plans (
      tenant_id, name, description, plan_type, monthly_price, usage_type, max_uses_per_month,
      benefits, included_benefits, display_order,
      participates_cashback, participates_traditional_loyalty, accumulates_premium_loyalty,
      allows_product_discount, agenda_priority, exclusive_hours, preferential_service
    ) VALUES (
      v_tenant, 'Plano Barber VIP', 'Melhor custo benefício.', 'hair_beard', 279.90, 'limited', 12,
      '{"haircuts":6,"beards":6}'::jsonb,
      '["Tudo do Semanal","Horários exclusivos","Atendimento prioritário","10% OFF em produtos","Convites para eventos","Brinde no aniversário","Upgrade automático nas campanhas Premium","Cartão Black"]'::jsonb,
      3, true, true, true, true, true, true, true
    );
  END IF;

  -- Elite
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE tenant_id = v_tenant AND name = 'Plano Barber Elite') THEN
    INSERT INTO public.subscription_plans (
      tenant_id, name, description, plan_type, monthly_price, usage_type, max_uses_per_month,
      benefits, included_benefits, display_order,
      participates_cashback, participates_traditional_loyalty, accumulates_premium_loyalty,
      allows_product_discount, agenda_priority, exclusive_hours, exclusive_days, preferential_service
    ) VALUES (
      v_tenant, 'Plano Barber Elite', 'Utilização praticamente ilimitada — até 20 atendimentos/mês.', 'hair_beard', 399.90, 'limited', 20,
      '{"haircuts":10,"beards":10}'::jsonb,
      '["Tudo do VIP","Desconto permanente em produtos","Convite VIP","Brindes exclusivos","Fila prioritária","Atendimento preferencial","Programa Elite","Suporte exclusivo","Cartão Black Elite"]'::jsonb,
      4, true, true, true, true, true, true, true, true
    );
  END IF;

  -- Ensure Semanal has display_order=2 and badge data
  UPDATE public.subscription_plans
  SET display_order = 2,
      included_benefits = COALESCE(NULLIF(included_benefits, '[]'::jsonb),
        '["Tudo do Essencial","Clube Premium","Programa de Indicação","Fidelidade Premium","Cashback","Avaliações VIP"]'::jsonb),
      participates_cashback = true,
      participates_traditional_loyalty = true,
      accumulates_premium_loyalty = true,
      agenda_priority = true
  WHERE tenant_id = v_tenant AND name = 'Plano Barber Semanal';
END $$;

-- RPC: customer-facing plan change request
CREATE OR REPLACE FUNCTION public.request_subscription_plan_change(
  _subscription_id uuid,
  _new_plan_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.customer_subscriptions%ROWTYPE;
  v_old public.subscription_plans%ROWTYPE;
  v_new public.subscription_plans%ROWTYPE;
  v_change_type text;
  v_days_remaining int;
  v_days_in_cycle int;
  v_change_id uuid;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = _subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  SELECT * INTO v_new FROM public.subscription_plans WHERE id = _new_plan_id AND tenant_id = v_sub.tenant_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de destino inválido';
  END IF;

  SELECT * INTO v_old FROM public.subscription_plans WHERE id = v_sub.plan_id;

  IF v_old.id = v_new.id THEN
    RAISE EXCEPTION 'Você já está neste plano';
  END IF;

  v_change_type := CASE
    WHEN v_new.monthly_price > COALESCE(v_old.monthly_price, 0) THEN 'upgrade'
    WHEN v_new.monthly_price < COALESCE(v_old.monthly_price, 0) THEN 'downgrade'
    ELSE 'same'
  END;

  v_days_in_cycle := GREATEST(1, EXTRACT(DAY FROM (v_sub.current_period_end - v_sub.current_period_start))::int);
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - now()))::int);

  INSERT INTO public.subscription_plan_changes (
    tenant_id, customer_id, subscription_id, old_plan_id, new_plan_id,
    old_price, new_price, days_remaining, days_in_cycle,
    change_type, effective_date, notes
  ) VALUES (
    v_sub.tenant_id, v_sub.customer_id, v_sub.id, v_old.id, v_new.id,
    COALESCE(v_old.monthly_price, 0), v_new.monthly_price, v_days_remaining, v_days_in_cycle,
    v_change_type,
    CASE WHEN v_change_type = 'downgrade' THEN v_sub.current_period_end ELSE now() END,
    'Solicitado pelo cliente via portal'
  ) RETURNING id INTO v_change_id;

  IF v_change_type = 'upgrade' OR v_change_type = 'same' THEN
    UPDATE public.customer_subscriptions
    SET plan_id = v_new.id,
        metadata = COALESCE(metadata, '{}'::jsonb) - 'pending_plan_id' - 'pending_plan_name',
        updated_at = now()
    WHERE id = v_sub.id;
  ELSE
    -- downgrade: store pending change, applied at renewal
    UPDATE public.customer_subscriptions
    SET metadata = COALESCE(metadata, '{}'::jsonb)
                   || jsonb_build_object('pending_plan_id', v_new.id::text, 'pending_plan_name', v_new.name),
        updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  RETURN jsonb_build_object(
    'change_id', v_change_id,
    'change_type', v_change_type,
    'applied', v_change_type IN ('upgrade','same'),
    'effective_at', CASE WHEN v_change_type = 'downgrade' THEN v_sub.current_period_end ELSE now() END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.request_subscription_plan_change(uuid, uuid) TO anon, authenticated, service_role;
