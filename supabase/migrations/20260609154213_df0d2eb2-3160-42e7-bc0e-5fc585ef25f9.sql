-- 1. LIMPAR DADOS FINANCEIROS DO TENANT ESPECÍFICO (Barbearia do Louis)
DO $$ 
DECLARE 
    target_tenant_id UUID := 'ab0fb7c1-b7c9-40ef-be97-14348e88ae65';
BEGIN
    -- Deletar registros financeiros vinculados
    DELETE FROM public.financial_adjustment_logs WHERE tenant_id = target_tenant_id;
    DELETE FROM public.credit_transactions WHERE tenant_id = target_tenant_id;
    DELETE FROM public.cashback_transactions WHERE tenant_id = target_tenant_id;
    DELETE FROM public.refund_requests WHERE tenant_id = target_tenant_id;
    DELETE FROM public.transactions WHERE tenant_id = target_tenant_id OR user_id = target_tenant_id;
    
    -- Limpar wallet_transactions
    DELETE FROM public.wallet_transactions 
    WHERE wallet_id IN (
        SELECT id FROM public.wallet 
        WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = target_tenant_id)
    );

    -- 2. RESETAR AGENDAMENTOS
    DELETE FROM public.appointment_status_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = target_tenant_id);
    DELETE FROM public.appointments WHERE tenant_id = target_tenant_id;
    DELETE FROM public.appointment_groups WHERE tenant_id = target_tenant_id;

    -- 3. RESETAR SALDOS DE CLIENTES
    UPDATE public.customers 
    SET 
        credit_balance = 0,
        cashback_balance = 0,
        loyalty_points = 0
    WHERE tenant_id = target_tenant_id;

    -- 4. LIMPAR WALLETS
    UPDATE public.wallet 
    SET balance = 0 
    WHERE customer_id IN (SELECT id FROM public.customers WHERE tenant_id = target_tenant_id);

END $$;
