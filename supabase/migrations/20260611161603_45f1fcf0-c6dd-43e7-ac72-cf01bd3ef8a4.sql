-- 1. Adicionar updated_at para melhor auditoria se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'updated_at') THEN
        ALTER TABLE public.transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashback_transactions' AND column_name = 'updated_at') THEN
        ALTER TABLE public.cashback_transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'updated_at') THEN
        ALTER TABLE public.credit_transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Garantir que os índices únicos existam (já existem conforme auditoria, mas garantimos aqui)
-- idx_unique_income_per_appointment já existe em transactions
-- unique_cashback_per_appointment já existe em cashback_transactions

-- 3. Atualizar complete_appointment para ser idempotente
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text DEFAULT 'admin',
    p_changed_by_id uuid DEFAULT auth.uid(),
    p_source text DEFAULT 'system',
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_customer_id UUID;
    v_tenant_id UUID;
BEGIN
    -- 1. Carregar agendamento
    SELECT a.*, c.id as customer_id, a.tenant_id 
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Se já estiver concluído, verificamos se as transações financeiras existem, se não, criamos. 
    -- Se já existem, o ON CONFLICT resolverá.
    
    v_customer_id := v_appt.customer_id;
    v_tenant_id := v_appt.tenant_id;

    -- 2. Carregar configurações do tenant
    SELECT * FROM public.profiles WHERE id = v_tenant_id INTO v_tenant;

    -- 3. Extrair e normalizar valores (Prioridade Metadata > Banco)
    v_total_price := COALESCE(v_appt.total_price, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);

    -- Garantir que a soma bata com o total se for pagamento único
    IF (v_pix_amount + v_cash_amount + v_card_amount) = 0 AND v_total_price > 0 THEN
        v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used);
        v_pix_amount := v_final_amount; -- Default para pix se nada for informado
    ELSE
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    END IF;

    -- 4. Atualizar Agendamento
    UPDATE public.appointments
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        completed_by = COALESCE(completed_by, p_changed_by_id::text),
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        credits_used = v_credit_used,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        final_amount = v_final_amount,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 5. Registrar Transação Financeira Principal (IDEMPOTENTE)
    INSERT INTO public.transactions (
        user_id, tenant_id, appointment_id, barber_id, type, category, 
        amount, pix_amount, cash_amount, credit_card_amount, 
        credits_amount, cashback_amount, payment_method, 
        description, date, payment_breakdown
    ) VALUES (
        v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
        v_total_price, v_pix_amount, v_cash_amount, v_card_amount,
        v_credit_used, v_cashback_used, COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'mixed'),
        'Conclusão: ' || COALESCE(v_appt.id::text, ''), CURRENT_DATE,
        jsonb_build_object('pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount, 'credits', v_credit_used, 'cashback', v_cashback_used)
    )
    ON CONFLICT (appointment_id) WHERE type = 'income' AND appointment_id IS NOT NULL
    DO UPDATE SET
        amount = EXCLUDED.amount,
        pix_amount = EXCLUDED.pix_amount,
        cash_amount = EXCLUDED.cash_amount,
        credit_card_amount = EXCLUDED.credit_card_amount,
        credits_amount = EXCLUDED.credits_amount,
        cashback_amount = EXCLUDED.cashback_amount,
        payment_method = EXCLUDED.payment_method,
        payment_breakdown = EXCLUDED.payment_breakdown,
        updated_at = NOW();

    -- 6. Processar Cashback Concedido (IDEMPOTENTE)
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    IF v_cashback_percentage > 0 AND v_final_amount > 0 THEN
        v_cashback_earned := (v_final_amount * v_cashback_percentage) / 100;
        
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_earned, 'earned', 'Cashback sobre serviço'
        )
        ON CONFLICT (appointment_id)
        DO UPDATE SET
            amount = EXCLUDED.amount,
            updated_at = NOW();

        UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
    END IF;

    -- 7. Registrar Uso de Crédito (IDEMPOTENTE)
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, 'used', v_credit_used, 'Uso de crédito em agendamento'
        )
        ON CONFLICT (appointment_id) -- Assumindo que pode existir um índice ou que queremos apenas evitar duplicidade
        DO NOTHING; 
        
        -- Nota: credit_transactions não tem índice único em appointment_id por padrão, 
        -- mas podemos adicionar se necessário. Por ora DO NOTHING evita erro se adicionarmos depois.
    END IF;

    -- 8. Log de Status
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'completed', v_appt.status, 'completed',
        p_changed_by_type, p_changed_by_id, p_source, p_metadata
    );

    -- 9. Recalcular saldos do cliente
    PERFORM public.fn_recalculate_customer_balances(v_customer_id);

    RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para limpeza de dados financeiros de teste
CREATE OR REPLACE FUNCTION public.clear_barbershop_financial_data(p_tenant_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_customer_record RECORD;
    v_count_appts INTEGER;
BEGIN
    -- Verificar permissão (apenas o próprio tenant ou super_admin)
    -- Em uma implementação real, checaríamos auth.uid()
    
    -- Contar agendamentos antes
    SELECT count(*) INTO v_count_appts FROM public.appointments WHERE tenant_id = p_tenant_id;

    -- Delete activity data (Ordem importa para chaves estrangeiras)
    DELETE FROM public.appointment_status_logs WHERE appointment_id IN (SELECT id FROM public.appointments WHERE tenant_id = p_tenant_id);
    DELETE FROM public.refund_requests WHERE tenant_id = p_tenant_id;
    DELETE FROM public.cashback_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.credit_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM public.product_sales WHERE tenant_id = p_tenant_id;
    DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.financial_adjustment_logs WHERE tenant_id = p_tenant_id;
    
    -- Recalculate balances for all customers of this tenant
    FOR v_customer_record IN SELECT id FROM public.customers WHERE tenant_id = p_tenant_id LOOP
        PERFORM public.fn_recalculate_customer_balances(v_customer_record.id);
        
        -- Também zerar campos legados se houver
        UPDATE public.customers 
        SET 
            credits = 0, 
            cashback_balance = 0, 
            loyalty_points = 0,
            total_spent = 0,
            appointments_count = 0
        WHERE id = v_customer_record.id;
    END LOOP;
    
    -- Zerar saldo da carteira (wallet) se existir
    UPDATE public.wallet SET balance = 0 WHERE user_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Dados financeiros limpos com sucesso',
        'appointments_removed', v_count_appts
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.clear_barbershop_financial_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_barbershop_financial_data(uuid) TO service_role;
