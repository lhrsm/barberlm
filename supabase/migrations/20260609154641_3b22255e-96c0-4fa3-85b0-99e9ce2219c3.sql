-- LIMPEZA PROFUNDA E DEFINITIVA - TENANT Barbearia LM
DO $$ 
DECLARE 
    target_tenant_id UUID := 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
BEGIN
    -- 1. LIMPAR REGISTROS FINANCEIROS E LOGS GERAIS
    DELETE FROM public.customer_credits WHERE tenant_id = target_tenant_id;
    DELETE FROM public.financial_adjustment_logs WHERE tenant_id = target_tenant_id;
    DELETE FROM public.credit_transactions WHERE tenant_id = target_tenant_id;
    DELETE FROM public.cashback_transactions WHERE tenant_id = target_tenant_id;
    DELETE FROM public.refund_requests WHERE tenant_id = target_tenant_id;
    DELETE FROM public.notifications WHERE tenant_id = target_tenant_id;
    DELETE FROM public.transactions WHERE tenant_id = target_tenant_id OR user_id = target_tenant_id;
    
    -- Limpar wallet_transactions e wallet
    DELETE FROM public.wallet_transactions WHERE wallet_id IN (SELECT id FROM public.wallet WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = target_tenant_id));

    -- 2. LIMPAR TODAS AS DEPENDÊNCIAS DE AGENDAMENTOS (FKs)
    DELETE FROM public.automation_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_send_history WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_v2_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_v2_dispatches WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_queue WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_cron_runs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.automation_webhook_logs WHERE tenant_id = target_tenant_id;
    DELETE FROM public.zapi_webhook_logs WHERE tenant_id = target_tenant_id;
    DELETE FROM public.automation_conversations WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    
    DELETE FROM public.appointment_status_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.service_ratings WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    
    -- 3. REMOVER AGENDAMENTOS E GRUPOS
    UPDATE public.appointments SET rescheduled_from_id = NULL WHERE tenant_id = target_tenant_id;
    DELETE FROM public.appointments WHERE tenant_id = target_tenant_id;
    DELETE FROM public.appointment_groups WHERE tenant_id = target_tenant_id;

    -- 4. RESETAR CLIENTES E WALLETS
    UPDATE public.customers SET credit_balance = 0, cashback_balance = 0, loyalty_points = 0 WHERE tenant_id = target_tenant_id;
    UPDATE public.wallet SET balance = 0 WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = target_tenant_id);

END $$;
