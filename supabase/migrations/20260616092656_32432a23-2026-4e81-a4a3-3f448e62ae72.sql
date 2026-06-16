
-- ============ subscription_plan_changes ============
CREATE TABLE IF NOT EXISTS public.subscription_plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  old_plan_id UUID,
  new_plan_id UUID,
  old_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  days_remaining INT NOT NULL DEFAULT 0,
  days_in_cycle INT NOT NULL DEFAULT 30,
  proration_credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  proration_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- positivo = cobrar, negativo = creditar
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade','downgrade','same')),
  effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoice_id UUID,
  credit_transaction_id UUID,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spc_tenant ON public.subscription_plan_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spc_subscription ON public.subscription_plan_changes(subscription_id);

GRANT SELECT, INSERT ON public.subscription_plan_changes TO authenticated;
GRANT ALL ON public.subscription_plan_changes TO service_role;

ALTER TABLE public.subscription_plan_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant read plan changes"
  ON public.subscription_plan_changes FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "tenant insert plan changes"
  ON public.subscription_plan_changes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

-- ============ preview_subscription_plan_change ============
CREATE OR REPLACE FUNCTION public.preview_subscription_plan_change(
  p_subscription_id UUID,
  p_new_plan_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_old_plan RECORD;
  v_new_plan RECORD;
  v_now TIMESTAMPTZ := now();
  v_total_days INT;
  v_days_remaining INT;
  v_old_price NUMERIC;
  v_new_price NUMERIC;
  v_credit NUMERIC;
  v_new_prorated NUMERIC;
  v_net NUMERIC;
  v_change_type TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada'); END IF;

  SELECT * INTO v_old_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
  SELECT * INTO v_new_plan FROM public.subscription_plans WHERE id = p_new_plan_id;
  IF v_new_plan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Novo plano não encontrado'); END IF;

  v_total_days := GREATEST(1, EXTRACT(DAY FROM (v_sub.current_period_end - v_sub.current_period_start))::INT);
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_end - v_now))::INT);

  v_old_price := COALESCE(v_old_plan.monthly_price, 0);
  v_new_price := COALESCE(v_new_plan.monthly_price, 0);

  v_credit := ROUND((v_old_price * v_days_remaining / v_total_days)::NUMERIC, 2);
  v_new_prorated := ROUND((v_new_price * v_days_remaining / v_total_days)::NUMERIC, 2);
  v_net := v_new_prorated - v_credit;

  IF v_new_price > v_old_price THEN v_change_type := 'upgrade';
  ELSIF v_new_price < v_old_price THEN v_change_type := 'downgrade';
  ELSE v_change_type := 'same';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'old_plan_id', v_sub.plan_id,
    'old_plan_name', v_old_plan.name,
    'old_price', v_old_price,
    'new_plan_id', p_new_plan_id,
    'new_plan_name', v_new_plan.name,
    'new_price', v_new_price,
    'days_in_cycle', v_total_days,
    'days_remaining', v_days_remaining,
    'proration_credit', v_credit,
    'proration_charge', v_new_prorated,
    'net_amount', v_net,
    'change_type', v_change_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_subscription_plan_change(UUID, UUID) TO authenticated;

-- ============ change_subscription_plan ============
CREATE OR REPLACE FUNCTION public.change_subscription_plan(
  p_subscription_id UUID,
  p_new_plan_id UUID,
  p_payment_method TEXT DEFAULT NULL,
  p_apply_credit_to_wallet BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_preview JSONB;
  v_invoice_id UUID;
  v_credit_id UUID;
  v_change_id UUID;
  v_net NUMERIC;
  v_credit NUMERIC;
  v_charge NUMERIC;
  v_change_type TEXT;
  v_payment_method TEXT;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Assinatura não encontrada'); END IF;
  IF v_sub.status NOT IN ('active','pending_payment','past_due') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assinatura precisa estar ativa para trocar plano');
  END IF;

  v_preview := public.preview_subscription_plan_change(p_subscription_id, p_new_plan_id);
  IF (v_preview->>'success')::BOOLEAN IS NOT TRUE THEN RETURN v_preview; END IF;

  v_credit := (v_preview->>'proration_credit')::NUMERIC;
  v_charge := (v_preview->>'proration_charge')::NUMERIC;
  v_net := (v_preview->>'net_amount')::NUMERIC;
  v_change_type := v_preview->>'change_type';
  v_payment_method := COALESCE(p_payment_method, v_sub.payment_method, 'in_person');

  -- Upgrade: gera fatura da diferença
  IF v_net > 0 THEN
    INSERT INTO public.subscription_invoices (
      tenant_id, subscription_id, customer_id, amount, status,
      payment_method, due_date
    ) VALUES (
      v_sub.tenant_id, v_sub.id, v_sub.customer_id, v_net, 'pending',
      v_payment_method, now()
    ) RETURNING id INTO v_invoice_id;
  ELSIF v_net < 0 AND p_apply_credit_to_wallet THEN
    -- Downgrade: crédito na carteira do cliente
    INSERT INTO public.customer_credits (
      tenant_id, customer_id, amount, source, description
    ) VALUES (
      v_sub.tenant_id, v_sub.customer_id, ABS(v_net),
      'subscription_downgrade',
      'Crédito por downgrade de plano'
    ) RETURNING id INTO v_credit_id;
  END IF;

  -- Atualiza assinatura para o novo plano (mantém datas do ciclo)
  UPDATE public.customer_subscriptions
  SET plan_id = p_new_plan_id, updated_at = now()
  WHERE id = p_subscription_id;

  -- Registra histórico
  INSERT INTO public.subscription_plan_changes (
    tenant_id, customer_id, subscription_id,
    old_plan_id, new_plan_id, old_price, new_price,
    days_remaining, days_in_cycle,
    proration_credit, proration_charge, net_amount,
    change_type, invoice_id, credit_transaction_id,
    changed_by, notes
  ) VALUES (
    v_sub.tenant_id, v_sub.customer_id, v_sub.id,
    (v_preview->>'old_plan_id')::UUID, p_new_plan_id,
    (v_preview->>'old_price')::NUMERIC, (v_preview->>'new_price')::NUMERIC,
    (v_preview->>'days_remaining')::INT, (v_preview->>'days_in_cycle')::INT,
    v_credit, v_charge, v_net,
    v_change_type, v_invoice_id, v_credit_id,
    auth.uid(), p_notes
  ) RETURNING id INTO v_change_id;

  RETURN jsonb_build_object(
    'success', true,
    'change_id', v_change_id,
    'invoice_id', v_invoice_id,
    'credit_id', v_credit_id,
    'net_amount', v_net,
    'change_type', v_change_type,
    'preview', v_preview
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_subscription_plan(UUID, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
