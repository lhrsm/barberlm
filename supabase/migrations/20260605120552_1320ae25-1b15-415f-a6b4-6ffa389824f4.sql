CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text DEFAULT 'admin'::text, p_changed_by_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'system'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cust RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_earned DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_credit_used DECIMAL(10, 2);
    v_cashback_used DECIMAL(10, 2);
    v_pix_amount DECIMAL(10, 2);
    v_cash_amount DECIMAL(10, 2);
    v_credit_card_amount DECIMAL(10, 2);
    v_debit_card_amount DECIMAL(10, 2);
    v_final_amount DECIMAL(10, 2);
    v_total_price DECIMAL(10, 2);
    v_trans_desc TEXT;
    v_payment_breakdown JSONB;
BEGIN
    -- 1. Get current appointment data
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN 
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado'); 
    END IF;
    
    IF v_appt.status = 'completed' THEN 
        RETURN jsonb_build_object('success', true, 'message', 'Já concluído'); 
    END IF;

    -- 2. Get tenant and customer data
    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;
    SELECT * INTO v_cust FROM customers WHERE id = v_appt.customer_id;

    -- 3. Determine values from metadata or defaults
    v_total_price := COALESCE(v_appt.original_total, v_appt.total_price, 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'local');
    
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    
    -- Extract breakdown if provided
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, (v_appt.payment_breakdown->>'cash_amount')::numeric, 0);
    v_credit_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (v_appt.payment_breakdown->>'credit_card_amount')::numeric, 0);
    v_debit_card_amount := COALESCE((p_metadata->>'debit_card_amount')::numeric, (v_appt.payment_breakdown->>'debit_card_amount')::numeric, 0);
    
    -- Logic for payment_method 'misto'
    IF v_payment_method != 'misto' THEN
        -- If multiple methods are used, force 'misto'
        IF (v_credit_used > 0 OR v_cashback_used > 0) AND (v_pix_amount > 0 OR v_cash_amount > 0 OR v_credit_card_amount > 0 OR v_debit_card_amount > 0) THEN
            v_payment_method := 'misto';
        ELSIF (v_pix_amount > 0 AND (v_cash_amount > 0 OR v_credit_card_amount > 0 OR v_debit_card_amount > 0)) THEN
            v_payment_method := 'misto';
        ELSIF v_payment_method = 'local' THEN
            -- Map 'local' to something more specific if possible
            IF v_pix_amount > 0 THEN v_payment_method := 'pix';
            ELSIF v_cash_amount > 0 THEN v_payment_method := 'dinheiro';
            ELSIF v_credit_card_amount > 0 THEN v_payment_method := 'card';
            END IF;
        END IF;
    END IF;

    -- Calculate final_amount (what was actually paid in "fresh money")
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_total_price - v_credit_used - v_cashback_used));
    IF v_final_amount < 0 THEN v_final_amount := 0; END IF;

    -- If final_amount is positive but no specific method is set, default to v_payment_method if it's not credit/cashback only
    IF v_final_amount > 0 AND v_pix_amount = 0 AND v_cash_amount = 0 AND v_credit_card_amount = 0 AND v_debit_card_amount = 0 THEN
        IF v_payment_method = 'pix' THEN v_pix_amount := v_final_amount;
        ELSIF v_payment_method = 'dinheiro' OR v_payment_method = 'cash' THEN v_cash_amount := v_final_amount;
        ELSIF v_payment_method = 'card' OR v_payment_method = 'credit_card' THEN v_credit_card_amount := v_final_amount;
        ELSIF v_payment_method = 'debit_card' THEN v_debit_card_amount := v_final_amount;
        ELSE v_pix_amount := v_final_amount; v_payment_method := 'pix'; -- Default to PIX
        END IF;
    END IF;

    -- Build breakdown JSON
    v_payment_breakdown := jsonb_build_object(
        'pix_amount', v_pix_amount,
        'cash_amount', v_cash_amount,
        'credit_card_amount', v_credit_card_amount,
        'debit_card_amount', v_debit_card_amount,
        'credits_used', v_credit_used,
        'cashback_used', v_cashback_used
    );

    -- 5. Deduct used credits and cashback from customer
    IF v_credit_used > 0 THEN
        UPDATE public.customers SET credits = GREATEST(0, COALESCE(credits, 0) - v_credit_used) WHERE id = v_appt.customer_id;
        INSERT INTO public.credit_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
        VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'usage', v_credit_used, 'Uso de créditos no agendamento');
    END IF;

    IF v_cashback_used > 0 THEN
        UPDATE public.customers SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - v_cashback_used) WHERE id = v_appt.customer_id;
        INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
        VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_used', v_cashback_used, 'Uso de cashback no agendamento');
    END IF;

    -- 6. Update appointment
    UPDATE public.appointments SET
        status = 'completed',
        payment_status = 'paid',
        payment_method = v_payment_method,
        credit_used = v_credit_used,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_credit_card_amount,
        debit_card_amount = v_debit_card_amount,
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        payment_breakdown = v_payment_breakdown,
        completed_at = now(),
        completed_by = p_changed_by_type,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 7. Register Transaction in Financial Ledger
    v_trans_desc := 'Atendimento: ' || COALESCE((SELECT name FROM services WHERE id = v_appt.service_id), 'Serviço') || ' - ' || COALESCE(v_cust.name, 'Cliente');
    
    INSERT INTO public.transactions (
        user_id, tenant_id, amount, type, description, category, barber_id, appointment_id, date, created_at,
        payment_method, pix_amount, cash_amount, credit_card_amount, debit_card_amount, credits_amount, cashback_amount, payment_breakdown
    ) VALUES (
        v_appt.tenant_id, v_appt.tenant_id, v_final_amount, 'income', v_trans_desc, 'Serviço', v_appt.barber_id, p_appointment_id, CURRENT_DATE, now(),
        v_payment_method, v_pix_amount, v_cash_amount, v_credit_card_amount, v_debit_card_amount, v_credit_used, v_cashback_used, v_payment_breakdown
    );

    -- 8. Cashback Earnings
    IF v_tenant.cashback_enabled AND v_final_amount > 0 THEN
        v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
        IF v_cashback_percentage > 0 THEN
            v_cashback_earned := v_final_amount * (v_cashback_percentage / 100);
            
            UPDATE public.customers SET 
                cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                loyalty_points = COALESCE(loyalty_points, 0) + 1
            WHERE id = v_cust.id;

            INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
            VALUES (v_appt.tenant_id, v_cust.id, p_appointment_id, 'cashback_earned', v_cashback_earned, 'Cashback ganho no serviço');
            
            UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'cashback_earned', v_cashback_earned, 'payment_method', v_payment_method);
END;
$function$;