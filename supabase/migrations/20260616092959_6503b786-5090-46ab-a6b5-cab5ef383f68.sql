
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

  IF v_net > 0 THEN
    INSERT INTO public.subscription_invoices (
      tenant_id, subscription_id, customer_id, amount, status,
      payment_method, due_date
    ) VALUES (
      v_sub.tenant_id, v_sub.id, v_sub.customer_id, v_net, 'pending',
      v_payment_method, now()
    ) RETURNING id INTO v_invoice_id;
  ELSIF v_net < 0 AND p_apply_credit_to_wallet THEN
    INSERT INTO public.customer_credits (
      tenant_id, customer_id, amount, used_amount, status, credit_type, description
    ) VALUES (
      v_sub.tenant_id, v_sub.customer_id, ABS(v_net), 0, 'available',
      'subscription_downgrade', 'Crédito por downgrade de plano'
    ) RETURNING id INTO v_credit_id;
  END IF;

  UPDATE public.customer_subscriptions
  SET plan_id = p_new_plan_id, updated_at = now()
  WHERE id = p_subscription_id;

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
