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
    v_final_amount DECIMAL(10, 2);
    v_total_price DECIMAL(10, 2);
    v_trans_desc TEXT;
    v_available_credits DECIMAL(10, 2);
    v_available_cashback DECIMAL(10, 2);
    v_remaining DECIMAL(10, 2);
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
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'local');
    
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_total_price - v_credit_used - v_cashback_used));

    -- NEW: Force balance usage if payment method is specifically cashback or credits and amounts are 0
    IF v_payment_method = 'cashback' AND v_cashback_used = 0 THEN
        v_cashback_used := v_total_price;
        v_final_amount := 0;
    ELSIF v_payment_method = 'credits' AND v_credit_used = 0 THEN
        v_credit_used := v_total_price;
        v_final_amount := 0;
    END IF;

    -- Sanity check: final_amount cannot be negative
    IF v_final_amount < 0 THEN v_final_amount := 0; END IF;

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
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        completed_at = now(),
        completed_by = p_changed_by_type,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 7. Register Transaction in Financial Ledger
    v_trans_desc := 'Serviço: ' || COALESCE((SELECT name FROM services WHERE id = v_appt.service_id), 'Serviço') || ' - ' || COALESCE(v_cust.name, 'Cliente');
    
    IF v_final_amount > 0 THEN
        v_trans_desc := v_trans_desc || ' (Real: R$ ' || v_final_amount || ')';
    END IF;
    IF v_credit_used > 0 THEN
        v_trans_desc := v_trans_desc || ' (Créditos: R$ ' || v_credit_used || ')';
    END IF;
    IF v_cashback_used > 0 THEN
        v_trans_desc := v_trans_desc || ' (Cashback: R$ ' || v_cashback_used || ')';
    END IF;

    INSERT INTO public.transactions (
        user_id, tenant_id, amount, type, description, category, barber_id, appointment_id, date, created_at
    ) VALUES (
        v_appt.tenant_id, v_appt.tenant_id, v_final_amount, 'income', v_trans_desc, 'Serviço', v_appt.barber_id, p_appointment_id, CURRENT_DATE, now()
    );

    -- 8. Cashback Earnings (only if final_amount > 0 and cashback is enabled)
    IF v_tenant.cashback_enabled AND v_final_amount > 0 THEN
        v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
        IF v_cashback_percentage > 0 THEN
            v_cashback_earned := v_final_amount * (v_cashback_percentage / 100);
            
            UPDATE public.customers SET 
                cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                loyalty_points = COALESCE(loyalty_points, 0) + floor(v_final_amount)::integer
            WHERE id = v_cust.id;

            INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, description)
            VALUES (v_appt.tenant_id, v_cust.id, p_appointment_id, 'earning', v_cashback_earned, 'Cashback ganho no serviço');
            
            UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'cashback_earned', v_cashback_earned);
END;
$function$;