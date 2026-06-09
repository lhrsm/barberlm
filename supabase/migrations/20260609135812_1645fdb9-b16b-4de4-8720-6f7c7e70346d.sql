-- 1. Create or Replace Financial Status Check (Updated)
CREATE OR REPLACE FUNCTION public.check_appointment_financial_status(p_appointment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Agendamento não encontrado');
    END IF;

    -- Lógica de detecção de Pix
    v_pix_amount := COALESCE(v_appt.pix_amount, 0);
    IF v_pix_amount = 0 AND v_appt.payment_method ~* 'pix' AND v_appt.payment_status = 'paid' THEN
        v_pix_amount := v_appt.total_price;
    END IF;

    v_is_pix_paid := (v_appt.payment_status = 'paid') AND (v_pix_amount > 0);
    
    -- Lógica de detecção de Créditos e Cashback
    v_credits_used := COALESCE(v_appt.credit_used, v_appt.credits_used, 0);
    v_cashback_used := COALESCE(v_appt.cashback_used, 0);

    RETURN jsonb_build_object(
        'has_paid_pix', v_is_pix_paid,
        'paid_pix_amount', v_pix_amount,
        'has_used_credits', (v_credits_used > 0),
        'used_credit_amount', v_credits_used,
        'has_used_cashback', (v_cashback_used > 0),
        'used_cashback_amount', v_cashback_used,
        'total_value', v_appt.total_price,
        'requires_financial_decision', (v_is_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop and Recreate complete_appointment to ensure correct parameters and logic
DROP FUNCTION IF EXISTS public.complete_appointment(uuid, text, uuid, text, jsonb);

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
    v_credit_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_pix_amount NUMERIC(10,2);
    v_cash_amount NUMERIC(10,2);
    v_card_amount NUMERIC(10,2);
    v_final_amount NUMERIC(10,2);
    v_payment_status TEXT;
    v_payment_method TEXT;
    v_trans_id UUID;
BEGIN
    -- Audit Load
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Avoid double completion financial impact
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já concluído');
    END IF;

    -- Extract values
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, v_appt.credits_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE((p_metadata->>'credit_card_amount')::numeric, (p_metadata->>'debit_card_amount')::numeric, v_appt.credit_card_amount, v_appt.debit_card_amount, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_appt.total_price - v_credit_used - v_cashback_used), 0);
    v_payment_status := COALESCE(p_metadata->>'payment_status', 'paid');
    v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');

    -- Update Appointment
    UPDATE public.appointments
    SET
        status = 'completed',
        payment_status = v_payment_status,
        completed_at = now(),
        completed_by = p_changed_by_id,
        updated_at = now(),
        credit_used = v_credit_used,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        amount_paid = v_final_amount,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        payment_method = v_payment_method,
        payment_breakdown = jsonb_build_object(
            'pix_amount', v_pix_amount,
            'cash_amount', v_cash_amount,
            'card_amount', v_card_amount,
            'credits_used', v_credit_used,
            'cashback_used', v_cashback_used
        )
    WHERE id = p_appointment_id;

    -- Financial Transaction Registration (Income)
    -- Only register income if there is real money (Pix, Cash, Card)
    IF (v_pix_amount + v_cash_amount + v_card_amount) > 0 OR v_final_amount > 0 THEN
        INSERT INTO public.transactions (
            user_id,
            tenant_id,
            appointment_id,
            barber_id,
            type,
            category,
            amount,
            pix_amount,
            cash_amount,
            credit_card_amount,
            credits_amount,
            cashback_amount,
            payment_method,
            description,
            date,
            payment_breakdown
        ) VALUES (
            v_appt.tenant_id,
            v_appt.tenant_id,
            p_appointment_id,
            v_appt.barber_id,
            'income',
            'Serviço',
            v_final_amount,
            v_pix_amount,
            v_cash_amount,
            v_card_amount,
            v_credit_used,
            v_cashback_used,
            v_payment_method,
            'Pagamento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente'),
            CURRENT_DATE,
            jsonb_build_object(
                'pix_amount', v_pix_amount,
                'cash_amount', v_cash_amount,
                'card_amount', v_card_amount,
                'credits_used', v_credit_used,
                'cashback_used', v_cashback_used
            )
        ) RETURNING id INTO v_trans_id;
    END IF;

    -- Log status change
    INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        changed_by_id,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'completed',
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_trans_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop and Recreate cancel_appointment to ensure correct parameters and logic
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT,
    p_source TEXT,
    p_refund_preference TEXT DEFAULT 'none',
    p_changed_by_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
    v_fin_status JSONB;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_tenant_id UUID;
    v_refund_id UUID;
BEGIN
    -- Load Appointment
    SELECT a.*, c.name as customer_name, s.name as service_name 
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já cancelado');
    END IF;

    -- Audit Finance
    v_fin_status := public.check_appointment_financial_status(p_appointment_id);
    v_is_pix_paid := (v_fin_status->>'has_paid_pix')::boolean;
    v_pix_amount := (v_fin_status->>'paid_pix_amount')::numeric;
    v_credits_used := (v_fin_status->>'used_credit_amount')::numeric;
    v_cashback_used := (v_fin_status->>'used_cashback_amount')::numeric;
    v_tenant_id := v_appt.tenant_id;

    -- 1. Automatic Reversion of Credits
    IF v_credits_used > 0 THEN
        UPDATE public.customers 
        SET 
            credits = COALESCE(credits, 0) + v_credits_used,
            credit_balance = COALESCE(credit_balance, 0) + v_credits_used,
            updated_at = now()
        WHERE id = v_appt.customer_id;
        
        -- Transaction Log (Type: credit_reversed for easy dashboard exclusion)
        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category, amount, description, date
        ) VALUES (
            v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'credit_reversed', 'Estorno', v_credits_used, 
            'Crédito devolvido: ' || COALESCE(v_appt.service_name, 'Serviço'), CURRENT_DATE
        );
    END IF;

    -- 2. Automatic Reversion of Cashback
    IF v_cashback_used > 0 THEN
        UPDATE public.customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_used,
            updated_at = now()
        WHERE id = v_appt.customer_id;
        
        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category, amount, description, date
        ) VALUES (
            v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'cashback_reversed', 'Estorno', v_cashback_used, 
            'Cashback devolvido: ' || COALESCE(v_appt.service_name, 'Serviço'), CURRENT_DATE
        );
    END IF;

    -- 3. Handle PIX Refund
    IF v_is_pix_paid THEN
        IF p_refund_preference = 'credits' THEN
            -- Convert to Credits
            UPDATE public.customers 
            SET 
                credits = COALESCE(credits, 0) + v_pix_amount,
                credit_balance = COALESCE(credit_balance, 0) + v_pix_amount,
                updated_at = now()
            WHERE id = v_appt.customer_id;

            INSERT INTO public.transactions (
                user_id, tenant_id, appointment_id, barber_id, type, category, amount, description, date
            ) VALUES (
                v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'credit_granted', 'Estorno', v_pix_amount, 
                'Pix convertido em crédito: ' || COALESCE(v_appt.service_name, 'Serviço'), CURRENT_DATE
            );
        ELSIF p_refund_preference = 'refund' THEN
            -- Create Refund Request
            INSERT INTO public.refund_requests (
                tenant_id, customer_id, appointment_id, amount, status, created_at
            ) VALUES (
                v_tenant_id, v_appt.customer_id, p_appointment_id, v_pix_amount, 'requested', now()
            ) RETURNING id INTO v_refund_id;
        END IF;
    END IF;

    -- Update Appointment Status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        refund_status = CASE 
            WHEN NOT v_is_pix_paid THEN 'completed'
            WHEN p_refund_preference = 'credits' THEN 'converted_to_credit'
            WHEN p_refund_preference = 'refund' THEN 'refund_requested'
            ELSE 'pending'
        END,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Status Log
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source
    ) VALUES (
        p_appointment_id, v_appt.status, 'cancelled', p_cancelled_by, p_changed_by_id, p_source
    );

    RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
