
-- Onda E: Split de Pagamento

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.settle_appointment_payment(
  p_appointment_id UUID,
  p_service_amount NUMERIC,
  p_products_amount NUMERIC,
  p_tip_amount NUMERIC,
  p_discount_amount NUMERIC,
  p_payment_breakdown JSONB,
  p_tip_barber_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt RECORD;
  v_uid UUID := auth.uid();
  v_is_owner BOOLEAN := false;
  v_is_barber BOOLEAN := false;
  v_cash NUMERIC := COALESCE((p_payment_breakdown->>'cash')::NUMERIC, 0);
  v_credit NUMERIC := COALESCE((p_payment_breakdown->>'credit_card')::NUMERIC, 0);
  v_debit NUMERIC := COALESCE((p_payment_breakdown->>'debit_card')::NUMERIC, 0);
  v_pix NUMERIC := COALESCE((p_payment_breakdown->>'pix')::NUMERIC, 0);
  v_other NUMERIC := COALESCE((p_payment_breakdown->>'other')::NUMERIC, 0);
  v_paid_total NUMERIC;
  v_expected NUMERIC;
  v_final NUMERIC;
  v_method TEXT;
  v_nonzero INT := 0;
  v_tip_barber UUID;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  v_is_owner := (v_uid = v_appt.tenant_id);
  IF NOT v_is_owner AND v_appt.barber_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.barbers b WHERE b.id = v_appt.barber_id AND b.user_id = v_uid
    ) INTO v_is_barber;
  END IF;

  IF NOT (v_is_owner OR v_is_barber) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  p_service_amount  := COALESCE(p_service_amount, 0);
  p_products_amount := COALESCE(p_products_amount, 0);
  p_tip_amount      := COALESCE(p_tip_amount, 0);
  p_discount_amount := COALESCE(p_discount_amount, 0);

  IF p_service_amount < 0 OR p_products_amount < 0 OR p_tip_amount < 0 OR p_discount_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valores negativos não permitidos');
  END IF;

  v_final := p_service_amount + p_products_amount + p_tip_amount - p_discount_amount;
  IF v_final < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Desconto maior que o total');
  END IF;

  v_paid_total := v_cash + v_credit + v_debit + v_pix + v_other;

  IF ROUND(v_paid_total::numeric, 2) <> ROUND(v_final::numeric, 2) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Total das formas de pagamento (' || v_paid_total || ') difere do total (' || v_final || ')'
    );
  END IF;

  -- Determine primary payment method
  IF v_cash > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'cash'; END IF;
  IF v_credit > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'credit_card'; END IF;
  IF v_debit > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'debit_card'; END IF;
  IF v_pix > 0 THEN v_nonzero := v_nonzero + 1; v_method := 'pix'; END IF;
  IF v_other > 0 THEN v_nonzero := v_nonzero + 1; v_method := COALESCE(v_method, 'other'); END IF;
  IF v_nonzero > 1 THEN v_method := 'mixed'; END IF;
  IF v_nonzero = 0 AND v_final = 0 THEN v_method := 'free'; END IF;

  v_tip_barber := COALESCE(p_tip_barber_id, v_appt.barber_id);

  UPDATE public.appointments SET
    service_amount = p_service_amount,
    products_amount = p_products_amount,
    tip_amount = p_tip_amount,
    tip_barber_id = v_tip_barber,
    discount_amount = p_discount_amount,
    subtotal_amount = p_service_amount + p_products_amount,
    final_amount = v_final,
    total_price = v_final,
    amount_paid = v_final,
    cash_amount = v_cash,
    credit_card_amount = v_credit,
    debit_card_amount = v_debit,
    pix_amount = v_pix,
    extra_amount = v_other,
    payment_method = v_method,
    payment_breakdown = p_payment_breakdown,
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_appointment_id;

  -- Register/refresh main financial transaction for the service+tip portion.
  -- Product portions are already lançadas por add_product_to_comanda.
  IF (p_service_amount + p_tip_amount - p_discount_amount) > 0 THEN
    INSERT INTO public.transactions (
      tenant_id, type, amount, category, description,
      payment_method, appointment_id, barber_id, transaction_date
    ) VALUES (
      v_appt.tenant_id, 'income',
      p_service_amount + p_tip_amount - p_discount_amount,
      CASE WHEN p_tip_amount > 0 THEN 'service_with_tip' ELSE 'service' END,
      'Fechamento agendamento #' || substring(p_appointment_id::text, 1, 8)
        || CASE WHEN p_tip_amount > 0 THEN ' (inclui gorjeta R$ ' || p_tip_amount || ')' ELSE '' END,
      v_method, p_appointment_id, v_appt.barber_id, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'final_amount', v_final,
    'payment_method', v_method
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_appointment_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, UUID) TO authenticated;
