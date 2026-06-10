-- 1. Garantir que a tabela refund_requests tenha as permissões corretas
GRANT ALL ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;

-- 2. Ajustar RLS de refund_requests para permitir que o tenant gerencie
DROP POLICY IF EXISTS "Users can view their tenant's refund requests" ON public.refund_requests;
CREATE POLICY "Tenants can manage their own refund requests" 
ON public.refund_requests 
FOR ALL 
TO authenticated 
USING (tenant_id = auth.uid()) 
WITH CHECK (tenant_id = auth.uid());

-- 3. Função para recalcular estatísticas do cliente (Fonte única de verdade)
CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(p_customer_id UUID, p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_cashback NUMERIC(10,2) := 0;
    v_total_credits NUMERIC(10,2) := 0;
    v_total_loyalty INTEGER := 0;
BEGIN
    -- Somar cashback (earned/granted - used/reversed)
    SELECT COALESCE(SUM(
        CASE 
            WHEN type IN ('earned', 'cashback_earned', 'granted') THEN amount 
            WHEN type IN ('used', 'debit', 'reversed', 'cashback_reversed') THEN -amount 
            ELSE 0 
        END
    ), 0)
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id
    INTO v_total_cashback;

    -- Somar créditos
    SELECT COALESCE(SUM(
        CASE 
            WHEN type IN ('earned', 'credit_earned', 'granted', 'manual_added') THEN amount 
            WHEN type IN ('used', 'debit', 'reversed', 'credit_reversed', 'manual_removed') THEN -amount 
            ELSE 0 
        END
    ), 0)
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id
    INTO v_total_credits;

    -- Contar agendamentos concluídos para fidelidade
    SELECT COUNT(*)
    FROM public.appointments
    WHERE customer_id = p_customer_id 
      AND tenant_id = p_tenant_id 
      AND status = 'completed'
    INTO v_total_loyalty;

    -- Atualizar o cadastro do cliente
    UPDATE public.customers
    SET 
        cashback_balance = GREATEST(0, v_total_cashback),
        credits = GREATEST(0, v_total_credits),
        loyalty_points = v_total_loyalty,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
        'success', true,
        'cashback_balance', v_total_cashback,
        'credits', v_total_credits,
        'loyalty_points', v_total_loyalty
    );
END;
$$;

-- 4. Atualizar a função complete_appointment para ser mais robusta
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text, 
    p_changed_by_id uuid, 
    p_source text DEFAULT 'frontend'::text, 
    p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_trans_id UUID;
    v_description TEXT;
    v_cashback_earned NUMERIC(10,2) := 0;
    v_existing_cashback BOOLEAN;
    v_existing_trans BOOLEAN;
BEGIN
    -- 1. Buscar agendamento e validar
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- 2. Buscar configurações do tenant (cashback)
    SELECT cashback_enabled, cashback_percentage, cashback_minimum_amount
    FROM public.profiles
    WHERE id = v_appt.tenant_id INTO v_tenant;

    -- 3. Extração de valores do metadata ou do agendamento
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, (p_metadata->>'card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Normalização
    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    
    -- 4. Registrar transação financeira de entrada (se não existir)
    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id AND type = 'income') INTO v_existing_trans;

    IF v_final_amount > 0 AND NOT v_existing_trans THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');
        
        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category, 
            amount, pix_amount, cash_amount, credit_card_amount, 
            credits_amount, cashback_amount, payment_method, 
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_final_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE, 
            jsonb_build_object(
                'pix', v_pix_amount, 'cash', v_cash_amount, 
                'card', v_card_amount, 'credits', v_credit_used, 
                'cashback', v_cashback_used
            )
        ) RETURNING id INTO v_trans_id;
    END IF;

    -- 5. Lógica de Cashback Concedido
    -- VERIFICAR DUPLICIDADE: Só gera se não houver transação de cashback vinculada
    SELECT EXISTS (
        SELECT 1 FROM public.cashback_transactions 
        WHERE appointment_id = p_appointment_id 
        AND type IN ('earned', 'cashback_earned', 'granted')
    ) INTO v_existing_cashback;

    IF NOT v_existing_cashback AND v_tenant.cashback_enabled = true AND v_final_amount >= COALESCE(v_tenant.cashback_minimum_amount, 0) THEN
        v_cashback_earned := (v_final_amount * v_tenant.cashback_percentage) / 100;
        
        IF v_cashback_earned > 0 THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_earned, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço')
            );
        END IF;
    END IF;

    -- 6. Debitar Cashback Usado (se houver e se não foi debitado)
    IF v_cashback_used > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'used'
        ) INTO v_existing_cashback;
        
        IF NOT v_existing_cashback THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_used, 'used',
                'Uso de Cashback: ' || COALESCE(v_appt.service_name, 'Serviço')
            );
        END IF;
    END IF;

    -- 7. Debitar Créditos Usados (se houver e se não foi debitado)
    IF v_credit_used > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.credit_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'used'
        ) INTO v_existing_cashback;
        
        IF NOT v_existing_cashback THEN
            INSERT INTO public.credit_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_credit_used, 'used',
                'Uso de Créditos: ' || COALESCE(v_appt.service_name, 'Serviço')
            );
        END IF;
    END IF;

    -- 8. Finalizar Agendamento
    UPDATE public.appointments SET
        status = 'completed',
        completed_at = NOW(),
        completed_by = 'admin',
        payment_status = v_payment_status,
        payment_method = v_payment_method,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        cashback_earned = v_cashback_earned
    WHERE id = p_appointment_id;

    -- 9. RECALCULAR TUDO (Sincronizar saldos)
    PERFORM public.recalculate_customer_stats(v_appt.customer_id, v_appt.tenant_id);

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_earned,
        'final_amount', v_final_amount,
        'loyalty_points_updated', true
    );
END;
$function$;