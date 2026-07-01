
CREATE OR REPLACE FUNCTION public.clear_barbershop_test_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
  v_deleted jsonb := '{}'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  BEGIN
    SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF v_caller <> p_tenant_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para limpar dados deste tenant';
  END IF;

  -- ============ OPERACIONAL / AGENDAMENTOS ============
  DELETE FROM public.appointment_status_logs
    WHERE appointment_id IN (SELECT id FROM public.appointments WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id);
  DELETE FROM public.appointment_reviews
    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_usage_logs
    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.appointment_groups
    WHERE tenant_id = p_tenant_id;

  -- Automação relacionada a agendamentos
  DELETE FROM public.automation_queue
    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_dispatches
    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_send_history
    WHERE tenant_id = p_tenant_id;

  DELETE FROM public.appointments
    WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id;

  -- ============ FINANCEIRO ============
  DELETE FROM public.transactions WHERE tenant_id = p_tenant_id OR user_id = p_tenant_id;
  DELETE FROM public.refund_audits WHERE tenant_id = p_tenant_id;
  DELETE FROM public.refund_requests WHERE tenant_id = p_tenant_id;
  DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM public.product_sales WHERE tenant_id = p_tenant_id;

  -- ============ CRÉDITO / CASHBACK / WALLET ============
  DELETE FROM public.credit_transactions
    WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.customer_credits
    WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.cashback_transactions
    WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.wallet_transactions
    WHERE tenant_id = p_tenant_id;

  -- ============ FIDELIDADE ============
  DELETE FROM public.loyalty_rewards
    WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.loyalty_campaign_participations
    WHERE campaign_id IN (SELECT id FROM public.loyalty_campaigns WHERE tenant_id = p_tenant_id);
  DELETE FROM public.subscription_loyalty_history WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_loyalty_rewards WHERE tenant_id = p_tenant_id;

  -- ============ COMISSÕES ============
  DELETE FROM public.commission_entries WHERE tenant_id = p_tenant_id;
  DELETE FROM public.commission_closings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.barber_commissions WHERE tenant_id = p_tenant_id;

  -- ============ RESET CUSTOMERS ============
  UPDATE public.customers
     SET credits = 0,
         credit_balance = 0,
         credits_used = 0,
         cashback_balance = 0,
         cashback_used = 0,
         loyalty_points = 0,
         total_spent = 0,
         lifetime_value = 0,
         last_visit = NULL
   WHERE tenant_id = p_tenant_id;

  -- ============ RESET ASSINATURAS (mantém plano ativo, zera consumo) ============
  UPDATE public.customer_subscriptions
     SET uses_this_period = 0
   WHERE tenant_id = p_tenant_id;

  v_deleted := jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cleared_at', now()
  );

  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_barbershop_test_data(uuid) TO authenticated;
