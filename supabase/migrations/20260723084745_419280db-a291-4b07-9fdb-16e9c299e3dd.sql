
CREATE OR REPLACE FUNCTION public.resolve_tenant_billing_context(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_sub record;
  v_plan record;
  v_voucher record;
  v_addons_total numeric := 0;
  v_original numeric := 0;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_has_voucher boolean := false;
BEGIN
  -- AUTHZ: só o próprio tenant ou super_admin
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error','unauthenticated');
  END IF;
  IF auth.uid() <> _tenant_id AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT id, email, business_name, plan
    INTO v_profile
    FROM public.profiles
    WHERE id = _tenant_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('error','tenant_not_found','tenant_id',_tenant_id);
  END IF;

  SELECT *
    INTO v_sub
    FROM public.subscriptions
    WHERE user_id = _tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

  SELECT id, name, slug, price_monthly
    INTO v_plan
    FROM public.plans
    WHERE slug = COALESCE(v_profile.plan, 'starter')
    LIMIT 1;

  v_original := COALESCE(v_plan.price_monthly, 0);

  SELECT COALESCE(SUM(unit_price * COALESCE(quantity,1)), 0)
    INTO v_addons_total
    FROM public.tenant_addons
    WHERE tenant_id = _tenant_id
      AND status IN ('active','trialing');

  SELECT v.*
    INTO v_voucher
    FROM public.saas_admin_vouchers v
    JOIN public.saas_admin_voucher_redemptions r ON r.voucher_id = v.id
    WHERE r.tenant_id = _tenant_id
      AND r.status = 'active'
      AND v.status = 'active'
      AND v.revoked_at IS NULL
      AND (v.expires_at IS NULL OR v.expires_at > now())
    ORDER BY r.applied_at DESC
    LIMIT 1;

  v_has_voucher := v_voucher.id IS NOT NULL;

  IF v_has_voucher THEN
    v_discount := ROUND(((v_original + v_addons_total) * COALESCE(v_voucher.discount_percentage,0) / 100)::numeric, 2);
  END IF;

  v_final := GREATEST((v_original + v_addons_total) - v_discount, 0);

  RETURN jsonb_build_object(
    'tenant_id', v_profile.id,
    'tenant_name', v_profile.business_name,
    'tenant_email', v_profile.email,
    'plan_slug', v_profile.plan,
    'plan_name', COALESCE(v_plan.name, v_profile.plan),
    'stripe_subscription_status', COALESCE(v_sub.stripe_subscription_status, v_sub.status),
    'stripe_subscription_id', v_sub.stripe_subscription_id,
    'billing_status', COALESCE(v_sub.billing_status,
      CASE WHEN v_has_voucher THEN 'voucher_active' ELSE 'active_paid' END),
    'billing_source', COALESCE(v_sub.billing_source,
      CASE WHEN v_has_voucher THEN 'voucher' ELSE 'stripe' END),
    'is_internal_test_tenant', COALESCE(v_sub.is_internal_test_tenant, false)
      OR (v_has_voucher AND v_voucher.purpose = 'internal_testing'),
    'has_active_voucher', v_has_voucher,
    'voucher', CASE WHEN v_has_voucher THEN jsonb_build_object(
      'id', v_voucher.id,
      'name', v_voucher.name,
      'purpose', v_voucher.purpose,
      'duration_type', v_voucher.duration_type,
      'starts_at', v_voucher.starts_at,
      'expires_at', v_voucher.expires_at,
      'discount_percentage', v_voucher.discount_percentage,
      'includes_all_addons', v_voucher.includes_all_addons,
      'requires_payment_method', v_voucher.requires_payment_method,
      'applied_at', v_voucher.applied_at
    ) ELSE NULL END,
    'original_monthly_amount', v_original,
    'addons_monthly_amount', v_addons_total,
    'discount_amount', v_discount,
    'final_monthly_amount', v_final,
    'requires_payment_method', COALESCE(v_voucher.requires_payment_method, true)
  );
END;
$$;
