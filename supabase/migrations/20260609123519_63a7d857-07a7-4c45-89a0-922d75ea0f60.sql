CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_cancelled_by text, p_source text DEFAULT 'admin'::text, p_refund_preference text DEFAULT 'none'::text, p_changed_by_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
    v_tenant_id UUID;
    v_is_pix_paid BOOLEAN;
    v_pix_amount NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_fin_status JSONB;
BEGIN
    -- 1. Fetch appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Prevent double cancellation
    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- Use our updated financial status check
    v_fin_status := public.check_appointment_financial_status(p_appointment_id);
    v_is_pix_paid := (v_fin_status->>'has_paid_pix')::boolean;
    v_pix_amount := (v_fin_status->>'paid_pix_amount')::numeric;
    v_credits_used := (v_fin_status->>'used_credit_amount')::numeric;
    v_cashback_used := (v_fin_status->>'used_cashback_amount')::numeric;
    v_tenant_id := v_appt.tenant_id;

    -- 3. Avoid duplicates for refund/credit if choosing refund
    IF v_is_pix_paid AND p_refund_preference = 'refund' THEN
        IF EXISTS (SELECT 1 FROM public.refund_requests WHERE appointment_id = p_appointment_id AND status NOT IN ('rejected', 'cancelled')) THEN
             RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de estorno ativa para este agendamento');
        END IF;
    END IF;

    -- 4. Automatically revert credits if any were used
    IF v_credits_used > 0 THEN
        -- Add to customer balance (updating both common columns to ensure display matches)
        UPDATE public.customers 
        SET 
            credits = COALESCE(credits, 0) + v_credits_used,
            credit_balance = COALESCE(credit_balance, 0) + v_credits_used,
            updated_at = now()
        WHERE id = v_appt.customer_id;
        
        -- Log credit transaction
        INSERT INTO public.credit_transactions (
            tenant_id,
            customer_id,
            appointment_id,
            type,
            amount,
            description,
            created_at
        ) VALUES (
            v_tenant_id,
            v_appt.customer_id,
            p_appointment_id,
            'reversion',
            v_credits_used,
            'Crédito devolvido por cancelamento de agendamento: ' || p_appointment_id,
            now()
        );
    END IF;

    -- 5. Automatically revert cashback if any was used
    IF v_cashback_used > 0 THEN
        UPDATE public.customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_used,
            updated_at = now()
        WHERE id = v_appt.customer_id;
        
        -- Log cashback transaction if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashback_transactions') THEN
            INSERT INTO public.cashback_transactions (
                tenant_id,
                customer_id,
                appointment_id,
                type,
                amount,
                description,
                created_at
            ) VALUES (
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                'reversion',
                v_cashback_used,
                'Cashback devolvido por cancelamento de agendamento: ' || p_appointment_id,
                now()
            );
        END IF;
    END IF;

    -- 6. Update appointment status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = now(),
        refund_status = CASE 
            WHEN NOT v_is_pix_paid THEN 'completed'
            WHEN p_refund_preference = 'credits' THEN 'converted_to_credit'
            WHEN p_refund_preference = 'refund' THEN 'refund_requested'
            ELSE 'pending'
        END,
        refund_type = CASE
            WHEN p_refund_preference = 'credits' THEN 'credits'
            WHEN p_refund_preference = 'refund' THEN 'refund'
            ELSE NULL
        END
    WHERE id = p_appointment_id;

    -- 7. Log status change
    INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        changed_by_id
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'cancelled',
        p_cancelled_by,
        p_source,
        p_changed_by_id
    );

    -- 8. Create refund request record if needed (PIX portion)
    IF v_is_pix_paid AND p_refund_preference = 'refund' THEN
        INSERT INTO public.refund_requests (
            tenant_id,
            appointment_id,
            customer_id,
            amount,
            payment_method,
            status,
            requested_at,
            created_at
        ) VALUES (
            v_tenant_id,
            p_appointment_id,
            v_appt.customer_id,
            v_pix_amount,
            'pix',
            'requested',
            now(),
            now()
        ) RETURNING id INTO v_refund_id;
    END IF;

    -- 9. Create credit for PIX portion if preferred
    IF v_is_pix_paid AND p_refund_preference = 'credits' THEN
        INSERT INTO public.customer_credits (
            tenant_id,
            customer_id,
            appointment_id,
            amount,
            credit_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_tenant_id,
            v_appt.customer_id,
            p_appointment_id,
            v_pix_amount,
            'refund_credit',
            'available',
            now(),
            now()
        ) RETURNING id INTO v_credit_id;
        
        -- Update customer balance for the PIX converted portion
        UPDATE public.customers 
        SET 
            credits = COALESCE(credits, 0) + v_pix_amount,
            credit_balance = COALESCE(credit_balance, 0) + v_pix_amount,
            updated_at = now()
        WHERE id = v_appt.customer_id;

        -- Register in transactions
        INSERT INTO public.transactions (
            user_id,
            tenant_id,
            amount,
            type,
            description,
            category,
            appointment_id,
            date,
            payment_method
        ) VALUES (
            v_tenant_id,
            v_tenant_id,
            v_pix_amount,
            'credit_granted',
            'Crédito por cancelamento (Pix convertido): ' || p_appointment_id,
            'Crédito',
            p_appointment_id,
            CURRENT_DATE,
            'credits'
        );
    END IF;

    -- 10. Return result
    RETURN jsonb_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'is_pix_paid', v_is_pix_paid,
        'pix_amount', v_pix_amount,
        'credits_reverted', v_credits_used,
        'cashback_reverted', v_cashback_used,
        'refund_id', v_refund_id,
        'credit_id', v_credit_id
    );
END;
$function$;
