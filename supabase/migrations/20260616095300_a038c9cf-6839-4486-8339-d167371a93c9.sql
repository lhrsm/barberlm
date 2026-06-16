
-- 1. Extend coupons with subscription scoping
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS first_month_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_applies_to_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_applies_to_check CHECK (applies_to IN ('order','subscription'));

CREATE INDEX IF NOT EXISTS idx_coupons_applies_to ON public.coupons(tenant_id, applies_to, active);

-- 2. Track coupon applied to a subscription
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS coupon_id uuid NULL REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_first_month_only boolean NOT NULL DEFAULT false;

-- 3. Discount tracking on invoices
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS coupon_id uuid NULL REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_amount numeric(10,2) NULL;

-- 4. Validate subscription coupon RPC
CREATE OR REPLACE FUNCTION public.validate_subscription_coupon(
  p_tenant_id uuid,
  p_code text,
  p_plan_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_discount numeric(10,2) := 0;
  v_final numeric(10,2) := COALESCE(p_plan_price, 0);
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código vazio');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom inválido ou inexistente');
  END IF;

  IF v_coupon.applies_to <> 'subscription' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este cupom não é válido para assinaturas');
  END IF;

  IF NOT v_coupon.active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom inativo');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom expirado');
  END IF;

  IF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.used_count,0) >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom atingiu o limite de usos');
  END IF;

  IF v_coupon.type = 'fixed' THEN
    v_discount := LEAST(v_coupon.value, COALESCE(p_plan_price,0));
  ELSE
    v_discount := ROUND((COALESCE(p_plan_price,0) * (v_coupon.value / 100.0))::numeric, 2);
  END IF;

  IF v_coupon.max_discount IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_coupon.max_discount);
  END IF;

  v_final := GREATEST(0, COALESCE(p_plan_price,0) - v_discount);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code,
    'discount_type', v_coupon.type,
    'discount_value', v_coupon.value,
    'first_month_only', v_coupon.first_month_only,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_subscription_coupon(uuid, text, numeric) TO authenticated, anon, service_role;
