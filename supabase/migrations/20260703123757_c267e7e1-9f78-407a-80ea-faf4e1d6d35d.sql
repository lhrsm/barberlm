CREATE OR REPLACE FUNCTION public.get_public_active_customer_subscription(
  _tenant_id uuid,
  _customer_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  plan_id uuid,
  status text,
  started_at timestamp with time zone,
  current_period_end timestamp with time zone,
  next_billing_at timestamp with time zone,
  uses_this_period integer,
  plan jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id,
    cs.tenant_id,
    cs.customer_id,
    cs.plan_id,
    cs.status,
    cs.started_at,
    cs.current_period_end,
    cs.next_billing_at,
    cs.uses_this_period,
    jsonb_build_object(
      'id', sp.id,
      'tenant_id', sp.tenant_id,
      'name', sp.name,
      'description', sp.description,
      'plan_type', sp.plan_type,
      'monthly_price', sp.monthly_price,
      'usage_type', sp.usage_type,
      'max_uses_per_month', sp.max_uses_per_month,
      'benefits', sp.benefits,
      'included_benefits', sp.included_benefits,
      'active', sp.active,
      'display_order', sp.display_order,
      'participates_traditional_loyalty', sp.participates_traditional_loyalty,
      'participates_cashback', sp.participates_cashback,
      'accumulates_premium_loyalty', sp.accumulates_premium_loyalty,
      'allows_product_discount', sp.allows_product_discount,
      'agenda_priority', sp.agenda_priority,
      'exclusive_hours', sp.exclusive_hours,
      'exclusive_days', sp.exclusive_days,
      'preferential_service', sp.preferential_service
    ) AS plan
  FROM public.customer_subscriptions cs
  JOIN public.customers c
    ON c.id = cs.customer_id
   AND c.user_id = cs.tenant_id
  LEFT JOIN public.subscription_plans sp
    ON sp.id = cs.plan_id
   AND sp.tenant_id = cs.tenant_id
  WHERE cs.tenant_id = _tenant_id
    AND cs.customer_id = _customer_id
    AND c.id = _customer_id
    AND cs.status = 'active'
  ORDER BY cs.started_at DESC NULLS LAST, cs.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_active_customer_subscription(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_active_customer_subscription(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_active_customer_subscription(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_active_customer_subscription(uuid, uuid) TO service_role;