DROP FUNCTION IF EXISTS public.complete_appointment(uuid,text,uuid,text,jsonb);

-- Função principal para concluir agendamento de forma atômica
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT,
    p_changed_by_id UUID,
    p_source TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
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

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

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
        completed_at = NOW(),
        completed_by = p_changed_by_id::text,
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

    -- 5. Registrar Transação Financeira Principal
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
    );

    -- 6. Processar Cashback Concedido (Apenas sobre dinheiro novo)
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    IF v_cashback_percentage > 0 AND v_final_amount > 0 THEN
        v_cashback_earned := (v_final_amount * v_cashback_percentage) / 100;
        
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_earned, 'earned', 'Cashback sobre serviço'
        );

        UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
    END IF;

    -- 7. Registrar Uso de Crédito (Se houver)
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_credit_used, 'used', 'Uso de crédito em agendamento'
        );
    END IF;

    -- 8. Registrar Uso de Cashback (Se houver)
    IF v_cashback_used > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_used, 'used', 'Uso de cashback em agendamento'
        );
    END IF;

    -- 9. Atualizar Fidelidade
    UPDATE public.customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + 1
    WHERE id = v_customer_id;

    -- 10. Recalcular saldos
    PERFORM public.fn_recalculate_customer_balances(v_customer_id);

    RETURN jsonb_build_object(
        'success', true, 
        'status_after', 'completed',
        'cashback_earned', v_cashback_earned
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
