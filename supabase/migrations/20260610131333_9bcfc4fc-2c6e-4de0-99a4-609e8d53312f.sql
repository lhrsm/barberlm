-- 1. Remover função antiga para poder atualizar parâmetros
DROP FUNCTION IF EXISTS public.complete_appointment(uuid,text,uuid,text,jsonb);

-- 2. Função para recalcular saldo de cashback de um cliente
CREATE OR REPLACE FUNCTION public.recalculate_customer_cashback_balance(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_earned NUMERIC(10,2);
    v_used NUMERIC(10,2);
    v_refunded NUMERIC(10,2);
    v_expired NUMERIC(10,2);
    v_balance NUMERIC(10,2);
BEGIN
    -- Soma ganhos ( earned, cashback_earned, granted )
    SELECT COALESCE(SUM(amount), 0) INTO v_earned
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('earned', 'cashback_earned', 'granted');

    -- Soma utilizados ( used, cashback_used )
    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('used', 'cashback_used');

    -- Soma devolvidos ( refunded, cashback_refund )
    SELECT COALESCE(SUM(amount), 0) INTO v_refunded
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('refunded', 'cashback_refund');

    -- Soma expirados
    SELECT COALESCE(SUM(amount), 0) INTO v_expired
    FROM public.cashback_transactions
    WHERE customer_id = p_customer_id AND type IN ('expired');

    v_balance := v_earned - v_used + v_refunded - v_expired;

    -- Atualiza a tabela customers
    UPDATE public.customers
    SET cashback_balance = v_balance
    WHERE id = p_customer_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para recalcular saldo de créditos de um cliente
CREATE OR REPLACE FUNCTION public.recalculate_customer_credit_balance(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_earned NUMERIC(10,2);
    v_used NUMERIC(10,2);
    v_refunded NUMERIC(10,2);
    v_balance NUMERIC(10,2);
BEGIN
    -- Tabela credit_transactions
    SELECT COALESCE(SUM(amount), 0) INTO v_earned
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('earned', 'credit_earned', 'granted', 'purchase', 'payout');

    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('used', 'credit_used');

    SELECT COALESCE(SUM(amount), 0) INTO v_refunded
    FROM public.credit_transactions
    WHERE customer_id = p_customer_id AND type IN ('refunded', 'credit_refund');

    v_balance := v_earned - v_used + v_refunded;

    -- Atualiza a tabela customers
    UPDATE public.customers
    SET credits = v_balance
    WHERE id = p_customer_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers para recálculo automático
CREATE OR REPLACE FUNCTION public.trigger_recalculate_cashback()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_customer_cashback_balance(OLD.customer_id);
        RETURN OLD;
    ELSE
        PERFORM public.recalculate_customer_cashback_balance(NEW.customer_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_recalculate_cashback ON public.cashback_transactions;
CREATE TRIGGER tr_recalculate_cashback
AFTER INSERT OR UPDATE OR DELETE ON public.cashback_transactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_cashback();

CREATE OR REPLACE FUNCTION public.trigger_recalculate_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_customer_credit_balance(OLD.customer_id);
        RETURN OLD;
    ELSE
        PERFORM public.recalculate_customer_credit_balance(NEW.customer_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_recalculate_credits ON public.credit_transactions;
CREATE TRIGGER tr_recalculate_credits
AFTER INSERT OR UPDATE OR DELETE ON public.credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_credits();

-- 5. Atualizar a função complete_appointment
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id UUID,
    p_changed_by_type TEXT,
    p_changed_by_id UUID,
    p_source TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
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
    v_cashback_base_amount NUMERIC(10,2);
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
    v_total_price := COALESCE(v_appt.total_price, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    
    -- Valores recebidos em dinheiro novo
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric, 
        (p_metadata->>'debit_card_amount')::numeric, 
        (p_metadata->>'card_amount')::numeric, 
        v_appt.credit_card_amount, 
        v_appt.debit_card_amount, 0
    );
    
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Normalização: v_final_amount é o que entrou de dinheiro novo
    IF (v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0 AND v_payment_method != 'mixed') THEN
        -- Fallback
        v_final_amount := v_total_price - v_credit_used - v_cashback_used;
        IF (v_payment_method = 'pix') THEN v_pix_amount := v_final_amount;
        ELSIF (v_payment_method = 'cash') THEN v_cash_amount := v_final_amount;
        END IF;
    ELSE
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    END IF;

    -- A base para cashback é apenas o dinheiro novo
    v_cashback_base_amount := v_final_amount;
    
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
    SELECT EXISTS (
        SELECT 1 FROM public.cashback_transactions 
        WHERE appointment_id = p_appointment_id 
        AND type IN ('earned', 'cashback_earned', 'granted')
    ) INTO v_existing_cashback;

    IF NOT v_existing_cashback AND v_tenant.cashback_enabled = true AND v_cashback_base_amount >= COALESCE(v_tenant.cashback_minimum_amount, 0) THEN
        v_cashback_earned := (v_cashback_base_amount * v_tenant.cashback_percentage) / 100;
        
        IF v_cashback_earned > 0 THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_earned, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço')
            );
        END IF;
    END IF;

    -- 6. Registrar Cashback Utilizado
    IF v_cashback_used > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_cashback_used, 'used',
            'Resgate no serviço: ' || COALESCE(v_appt.service_name, 'Serviço')
        );
    END IF;

    -- 7. Registrar Crédito Utilizado
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_credit_used, 'used',
            'Resgate no serviço: ' || COALESCE(v_appt.service_name, 'Serviço')
        );
    END IF;

    -- 8. Atualizar agendamento para completed
    UPDATE public.appointments SET
        status = 'completed',
        payment_status = v_payment_status,
        payment_method = v_payment_method,
        credits_used = v_credit_used,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        final_amount = v_final_amount,
        cashback_earned = v_cashback_earned,
        completed_at = NOW(),
        completed_by = p_changed_by_type,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'final_amount', v_final_amount, 
        'cashback_earned', v_cashback_earned,
        'cashback_used', v_cashback_used
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recálculo manual inicial
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id FROM public.customers) LOOP
        PERFORM public.recalculate_customer_cashback_balance(r.id);
        PERFORM public.recalculate_customer_credit_balance(r.id);
    END LOOP;
END $$;
