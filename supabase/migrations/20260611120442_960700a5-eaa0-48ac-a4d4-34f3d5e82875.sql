-- 1. Update update_appointment_status function
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id uuid, 
    p_new_status text, 
    p_changed_by_type text, 
    p_changed_by_id uuid DEFAULT NULL::uuid, 
    p_source text DEFAULT NULL::text, 
    p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_old_status TEXT;
    v_appointment RECORD;
    v_is_pix_paid BOOLEAN;
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_rows_affected INTEGER;
    v_log_created BOOLEAN := false;
    v_log_error TEXT;
BEGIN
    -- Audit Load
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_old_status := v_appointment.status;

    -- SAFETY CHECK: If status is being changed to 'cancelled' by a CUSTOMER
    IF p_new_status = 'cancelled' AND (p_changed_by_type = 'customer' OR p_source ILIKE '%portal%' OR p_source ILIKE '%public%') THEN
        v_credits_used := COALESCE(v_appointment.credits_used, 0);
        v_cashback_used := COALESCE(v_appointment.cashback_used, 0);
        v_is_pix_paid := (v_appointment.payment_status = 'paid') AND (COALESCE(v_appointment.pix_amount, 0) > 0 OR v_appointment.payment_method ~* 'pix');

        -- Block direct cancellation if financial value exists
        IF v_is_pix_paid OR v_credits_used > 0 OR v_cashback_used > 0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Este agendamento possui valor financeiro e não pode ser cancelado diretamente. Use o fluxo de estorno/crédito.',
                'requires_financial_decision', true
            );
        END IF;
    END IF;

    -- Dynamic Update
    EXECUTE format('
        UPDATE appointments
        SET
            status = $1,
            updated_at = now(),
            confirmed_at = CASE WHEN $1 = ''confirmed'' THEN now() ELSE confirmed_at END,
            confirmed_by = CASE WHEN $1 = ''confirmed'' THEN $2 ELSE confirmed_by END,
            completed_at = CASE WHEN $1 = ''completed'' THEN now() ELSE completed_at END,
            completed_by = CASE WHEN $1 = ''completed'' THEN $2 ELSE completed_by END,
            cancelled_at = CASE WHEN $1 = ''cancelled'' THEN now() ELSE cancelled_at END,
            cancelled_by = CASE WHEN $1 = ''cancelled'' THEN $2 ELSE cancelled_by END,
            cancel_source = CASE WHEN $1 = ''cancelled'' THEN $3 ELSE cancel_source END
        WHERE id = $4', p_new_status, p_changed_by_type, p_source, p_appointment_id)
    USING p_new_status, p_changed_by_type, p_source, p_appointment_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- Logging
    BEGIN
        INSERT INTO appointment_status_logs (
            appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
        ) VALUES (
            p_appointment_id, v_old_status, p_new_status, p_changed_by_type, p_changed_by_id, p_source, p_metadata
        );
        v_log_created := true;
    EXCEPTION WHEN OTHERS THEN
        v_log_created := false;
        v_log_error := SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'status_before', v_old_status, 
        'status_after', p_new_status, 
        'rows_updated', v_rows_affected,
        'log_created', v_log_created,
        'log_error', v_log_error
    );
END;
$function$;

-- 2. Update cancel_appointment function
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid, 
    p_cancelled_by text, 
    p_source text, 
    p_refund_preference text DEFAULT 'none'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_fin_status JSONB;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_tenant_id UUID;
    v_refund_id UUID;
    v_rows_affected INTEGER;
    v_log_created BOOLEAN := false;
    v_log_error TEXT;
    v_status_before TEXT;
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

    v_status_before := v_appt.status;

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
        
        -- Transaction Log
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

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- Status Log
    BEGIN
        INSERT INTO public.appointment_status_logs (
            appointment_id, old_status, new_status, changed_by_type, changed_by_id, source
        ) VALUES (
            p_appointment_id, v_status_before, 'cancelled', p_cancelled_by, p_changed_by_id, p_source
        );
        v_log_created := true;
    EXCEPTION WHEN OTHERS THEN
        v_log_created := false;
        v_log_error := SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'status_before', v_status_before, 
        'status_after', 'cancelled', 
        'rows_updated', v_rows_affected,
        'refund_id', v_refund_id,
        'log_created', v_log_created,
        'log_error', v_log_error
    );
END;
$function$;
