
CREATE OR REPLACE FUNCTION public.clear_barbershop_test_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
  v_appt_ids uuid[];
  v_cust_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  BEGIN
    SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN v_is_admin := false;
  END;

  IF v_caller <> p_tenant_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para limpar dados deste tenant';
  END IF;

  SELECT array_agg(id) INTO v_appt_ids FROM public.appointments
    WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id;
  SELECT array_agg(id) INTO v_cust_ids FROM public.customers WHERE tenant_id = p_tenant_id;

  -- Referências a appointments (tudo que tem appointment_id FK)
  IF v_appt_ids IS NOT NULL THEN
    DELETE FROM public.automation_logs           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_conversations  WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_cron_runs      WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_webhook_logs   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_dispatches  WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_sessions    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_v2_logs        WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_queue          WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_dispatches     WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.automation_send_history   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.whatsapp_conversations    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.whatsapp_delivery_logs    WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.service_ratings           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.wallet_transactions       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.transactions              WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.credit_transactions       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.customer_credits          WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.cashback_transactions     WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.refund_audits             WHERE refund_id IN (SELECT id FROM public.refund_requests WHERE appointment_id = ANY(v_appt_ids));
    DELETE FROM public.refund_requests           WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.financial_adjustment_logs WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.appointment_status_logs   WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.appointment_reviews       WHERE appointment_id = ANY(v_appt_ids);
    DELETE FROM public.subscription_usage_logs   WHERE appointment_id = ANY(v_appt_ids);
    -- appointments com self-FK: quebra vínculo antes
    UPDATE public.appointments SET rescheduled_from_id = NULL WHERE rescheduled_from_id = ANY(v_appt_ids);
  END IF;

  -- Extras por tenant (por segurança)
  DELETE FROM public.appointment_reviews       WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_usage_logs   WHERE tenant_id = p_tenant_id;
  DELETE FROM public.appointment_groups        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_queue          WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_dispatches     WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_send_history   WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_dispatches  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_sessions    WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_v2_logs        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.automation_conversations  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.zapi_webhook_debug        WHERE tenant_id = p_tenant_id;
  DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;

  -- Agora apaga agendamentos
  DELETE FROM public.appointments WHERE user_id = p_tenant_id OR tenant_id = p_tenant_id;

  -- Financeiro geral
  DELETE FROM public.transactions              WHERE tenant_id = p_tenant_id OR user_id = p_tenant_id;
  DELETE FROM public.refund_audits             WHERE tenant_id = p_tenant_id;
  DELETE FROM public.refund_requests           WHERE tenant_id = p_tenant_id;
  DELETE FROM public.product_sales             WHERE tenant_id = p_tenant_id;

  -- Créditos / cashback / wallet
  IF v_cust_ids IS NOT NULL THEN
    DELETE FROM public.credit_transactions   WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.customer_credits      WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.cashback_transactions WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.wallet_transactions   WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.loyalty_rewards       WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM public.subscription_loyalty_history WHERE customer_id = ANY(v_cust_ids);
  END IF;
  DELETE FROM public.wallet_transactions WHERE tenant_id = p_tenant_id;

  -- Fidelidade
  DELETE FROM public.loyalty_campaign_participations
    WHERE campaign_id IN (SELECT id FROM public.loyalty_campaigns WHERE tenant_id = p_tenant_id);
  DELETE FROM public.subscription_loyalty_history  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscription_loyalty_rewards  WHERE tenant_id = p_tenant_id;

  -- Comissões
  DELETE FROM public.commission_entries   WHERE tenant_id = p_tenant_id;
  DELETE FROM public.commission_closings  WHERE tenant_id = p_tenant_id;
  DELETE FROM public.barber_commissions   WHERE tenant_id = p_tenant_id;

  -- Reset clientes
  UPDATE public.customers
     SET credits = 0, credit_balance = 0, credits_used = 0,
         cashback_balance = 0, cashback_used = 0,
         loyalty_points = 0, total_spent = 0, lifetime_value = 0,
         last_visit = NULL
   WHERE tenant_id = p_tenant_id;

  -- Reset consumo assinatura (mantém plano ativo)
  UPDATE public.customer_subscriptions
     SET uses_this_period = 0
   WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'tenant_id', p_tenant_id, 'cleared_at', now());
END;
$function$;
