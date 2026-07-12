
-- Comanda Digital (Onda D): link product sales to an appointment and provide RPCs
-- to add/remove products during service.

ALTER TABLE public.product_sales
  ADD COLUMN IF NOT EXISTS appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_sales_appointment_id ON public.product_sales(appointment_id);

-- Helper: validate the caller (barbershop owner OR the barber on the appointment)
-- owns/participates in the appointment. Returns tenant_id.
CREATE OR REPLACE FUNCTION public.assert_comanda_access(p_appointment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_barber UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT tenant_id, barber_id INTO v_tenant, v_barber
  FROM public.appointments WHERE id = p_appointment_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  -- Shop owner
  IF v_tenant = v_uid THEN
    RETURN v_tenant;
  END IF;

  -- Barber assigned to this appointment (barbers table)
  IF EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = v_barber AND b.user_id = v_tenant
      AND (b.id = v_uid OR b.user_id = v_uid)
  ) THEN
    RETURN v_tenant;
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$$;

-- Add a product line to the comanda
CREATE OR REPLACE FUNCTION public.add_product_to_comanda(
  p_appointment_id UUID,
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_product RECORD;
  v_appointment RECORD;
  v_total NUMERIC;
  v_sale_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  v_tenant := public.assert_comanda_access(p_appointment_id);

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND user_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  IF COALESCE(v_product.stock_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;

  v_total := ROUND((v_product.price * p_quantity)::numeric, 2);

  -- Insert product sale linked to appointment
  INSERT INTO public.product_sales (
    user_id, barber_id, appointment_id, items, total_amount, status
  ) VALUES (
    v_tenant,
    v_appointment.barber_id,
    p_appointment_id,
    jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'quantity', p_quantity,
      'price', v_product.price
    )),
    v_total,
    'completed'
  ) RETURNING id INTO v_sale_id;

  -- Decrement stock
  UPDATE public.products
    SET stock_quantity = stock_quantity - p_quantity
    WHERE id = p_product_id;

  -- Register transaction (income)
  INSERT INTO public.transactions (
    user_id, tenant_id, barber_id, appointment_id, amount, type, category, description, date
  ) VALUES (
    v_tenant, v_tenant, v_appointment.barber_id, p_appointment_id,
    v_total, 'income', 'Venda de Produto',
    'Comanda: ' || v_product.name || ' x' || p_quantity,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  -- Append to appointment items + bump totals
  UPDATE public.appointments
    SET items = COALESCE(items, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'id', v_product.id,
          'sale_id', v_sale_id,
          'name', v_product.name,
          'type', 'product',
          'quantity', p_quantity,
          'price', v_product.price,
          'total', v_total
        )),
        total_price = COALESCE(total_price, 0) + v_total,
        final_amount = COALESCE(final_amount, 0) + v_total,
        updated_at = now()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'total', v_total);
END;
$$;

-- Remove a product line from the comanda (reverts stock, transaction, totals)
CREATE OR REPLACE FUNCTION public.remove_comanda_item(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_tenant UUID;
  v_item JSONB;
  v_qty INTEGER;
  v_prod_id UUID;
BEGIN
  SELECT * INTO v_sale FROM public.product_sales WHERE id = p_sale_id;
  IF NOT FOUND OR v_sale.appointment_id IS NULL THEN
    RAISE EXCEPTION 'sale_not_found';
  END IF;

  v_tenant := public.assert_comanda_access(v_sale.appointment_id);

  -- Restore stock for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sale.items, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_prod_id IS NOT NULL THEN
      UPDATE public.products SET stock_quantity = COALESCE(stock_quantity,0) + v_qty WHERE id = v_prod_id;
    END IF;
  END LOOP;

  -- Delete transaction linked to this sale (best-effort by description marker; safer: nothing)
  DELETE FROM public.transactions
    WHERE appointment_id = v_sale.appointment_id
      AND category = 'Venda de Produto'
      AND amount = v_sale.total_amount
      AND description LIKE 'Comanda:%';

  -- Bump appointment totals down + remove item entry with sale_id
  UPDATE public.appointments a
    SET items = COALESCE((
          SELECT jsonb_agg(el)
          FROM jsonb_array_elements(COALESCE(a.items, '[]'::jsonb)) AS el
          WHERE COALESCE(el->>'sale_id','') <> p_sale_id::text
        ), '[]'::jsonb),
        total_price = GREATEST(0, COALESCE(a.total_price,0) - v_sale.total_amount),
        final_amount = GREATEST(0, COALESCE(a.final_amount,0) - v_sale.total_amount),
        updated_at = now()
    WHERE a.id = v_sale.appointment_id;

  DELETE FROM public.product_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_comanda_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_product_to_comanda(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_comanda_item(UUID) TO authenticated;
