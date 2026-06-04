CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text DEFAULT 'admin'::text,
    p_changed_by_id uuid DEFAULT NULL::uuid,
    p_source text DEFAULT 'system'::text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
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

    -- 4. Logic to auto-deduct if not provided but exists in balance (optional, usually provided by FE)
    -- We'll trust what FE sends in p_metadata, but ensure sanity.
    
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
        payment_status = v_payment_status,
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
    -- Description with full composition
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

    -- Create transaction (even if v_final_amount is 0, to show in financial panel)
    -- We store v_final_amount in 'amount' column because that's what represents cash inflow
    INSERT INTO public.transactions (
        amount, 
        type, 
        description, 
        category, 
        barber_id, 
        appointment_id, 
        tenant_id, 
        user_id, 
        date
    ) VALUES (
        v_final_amount,
        'income',
        v_trans_desc,
        'Serviço',
        v_appt.barber_id,
        p_appointment_id,
        v_appt.tenant_id,
        v_appt.tenant_id,
        CURRENT_DATE
    );

    -- 8. Award new cashback if enabled
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        SELECT EXISTS (SELECT 1 FROM public.cashback_transactions WHERE appointment_id = p_appointment_id AND type = 'cashback_earned') INTO v_already_earned;
        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            -- Cashback is earned over the TOTAL price
            v_cashback_earned := (v_total_price * v_cashback_percentage) / 100;
            
            IF v_cashback_earned > 0 THEN
                UPDATE public.customers SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned WHERE id = v_appt.customer_id;
                INSERT INTO public.cashback_transactions (tenant_id, customer_id, appointment_id, type, amount, base_amount, description)
                VALUES (v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_earned, v_total_price, 'Cashback ganho no agendamento');
                
                -- Also update appointment for easier tracking
                UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
            END IF;
        END IF;
    END IF;

    -- 9. Log status change
    INSERT INTO appointment_status_logs (appointment_id, old_status, new_status, changed_by_type, changed_by_id, source)
    VALUES (p_appointment_id, v_appt.status, 'completed', p_changed_by_type, p_changed_by_id, p_source);

    RETURN jsonb_build_object('success', true);
END;
$function$;