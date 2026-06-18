CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid, p_changed_by_type text DEFAULT 'system'::text, p_changed_by_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'rpc'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
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
    v_total_price NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_extra_amount NUMERIC(10,2);
    v_cashbackable_base NUMERIC(10,2);
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_existing_trans BOOLEAN;
    v_rows_affected INTEGER;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
    v_cashback_blocked_by_subscription BOOLEAN := false;
    v_log_created BOOLEAN := false;
    v_log_error TEXT;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_income_amount NUMERIC(10,2);
    v_fully_covered BOOLEAN;
BEGIN
    SELECT a.*, c.name as customer_name, s.name as service_name
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = a.customer_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_status_before := v_appt.status;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Agendamento já concluído',
            'appointment_id', p_appointment_id,
            'status_before', 'completed',
            'status_after', 'completed',
            'rows_updated', 0
        );
    END IF;

    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    v_total_price := COALESCE(v_appt.total_price, 0);
    v_sub_covered := COALESCE(v_appt.subscription_covered_amount, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, (p_metadata->>'credit_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);

    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric,
        (p_metadata->>'debit_card_amount')::numeric,
        (p_metadata->>'card_amount')::numeric,
        v_appt.credit_card_amount,
        v_appt.debit_card_amount, 0
    );

    -- Extra amount = parte NÃO coberta pela assinatura nem por créditos/cashback
    v_extra_amount := GREATEST(0, v_total_price - v_sub_covered);
    v_fully_covered := (v_appt.subscription_id IS NOT NULL AND v_sub_covered > 0 AND v_sub_covered >= v_total_price);

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    IF v_final_amount = 0 AND v_extra_amount > 0 THEN
        v_final_amount := GREATEST(0, v_extra_amount - v_credit_used - v_cashback_used);
        IF v_final_amount > 0 AND v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0 THEN
             v_pix_amount := v_final_amount;
        END IF;
    END IF;

    -- payment_method / status
    IF v_fully_covered THEN
        v_payment_method := 'subscription';
        v_payment_status := 'covered_by_subscription';
    ELSE
        v_payment_method := COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix');
        v_payment_status := COALESCE(v_appt.payment_status, 'paid');
    END IF;

    -- Cashback: base = total - coberto pela assinatura. Se totalmente coberto, NÃO gera cashback.
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    v_cashbackable_base := v_extra_amount;

    IF v_fully_covered THEN
        v_cashback_blocked_by_subscription := true;
        v_cashback_earned := 0;
    ELSIF v_cashback_percentage > 0 AND v_cashbackable_base > 0 THEN
        v_cashback_earned := (v_cashbackable_base * v_cashback_percentage) / 100;
        IF v_sub_covered > 0 THEN
            v_cashback_blocked_by_subscription := true;
        END IF;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id) INTO v_existing_trans;

    -- Income: somente sobre o valor EXTRA (não coberto pela assinatura)
    v_income_amount := v_extra_amount;

    IF NOT v_existing_trans AND v_income_amount > 0 THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente')
            || CASE WHEN v_sub_covered > 0 THEN ' (diferença assinatura)' ELSE '' END;

        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category,
            amount, pix_amount, cash_amount, credit_card_amount,
            credits_amount, cashback_amount, payment_method,
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_income_amount, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, v_payment_method,
            v_description, CURRENT_DATE,
            jsonb_build_object(
                'pix', v_pix_amount,
                'cash', v_cash_amount,
                'card', v_card_amount,
                'credits', v_credit_used,
                'cashback', v_cashback_used,
                'subscription_covered', v_sub_covered,
                'total_price', v_total_price,
                'extra_amount', v_extra_amount
            )
        );
    END IF;

    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, base_amount, type, description
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, v_cashbackable_base, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço') ||
                CASE WHEN v_sub_covered > 0 THEN ' (apenas valor extra)' ELSE '' END
            ) RETURNING id INTO v_cashback_tx_id;

            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    -- Consumir usage logs pendentes desta assinatura/agendamento
    IF v_appt.subscription_id IS NOT NULL AND v_sub_covered > 0 THEN
        UPDATE public.subscription_usage_logs
        SET status = 'consumed',
            used_at = COALESCE(used_at, now())
        WHERE appointment_id = p_appointment_id
          AND (status IS NULL OR status NOT IN ('consumed','refunded'));
    END IF;

    UPDATE public.appointments
    SET
        status = 'completed',
        completed_at = now(),
        updated_at = now(),
        cashback_earned = v_cashback_earned,
        payment_method = v_payment_method,
        payment_status = v_payment_status,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount
    WHERE id = p_appointment_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    BEGIN
        INSERT INTO public.appointment_status_logs (
            appointment_id, old_status, new_status, status_before, status_after,
            changed_by_type, changed_by_id, source, metadata
        ) VALUES (
            p_appointment_id, v_status_before, 'completed', v_status_before, 'completed',
            p_changed_by_type, p_changed_by_id, p_source,
            p_metadata || jsonb_build_object(
                'cashback_earned', v_cashback_earned,
                'cashback_tx_id', v_cashback_tx_id,
                'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
                'subscription_covered_amount', v_sub_covered,
                'extra_amount', v_extra_amount,
                'income_amount', v_income_amount,
                'fully_covered_by_subscription', v_fully_covered,
                'total_price', v_total_price,
                'final_amount', v_final_amount,
                'payment_method', v_payment_method,
                'payment_status', v_payment_status
            )
        );
        v_log_created := true;
    EXCEPTION WHEN OTHERS THEN
        v_log_error := SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'status_before', v_status_before,
        'status_after', 'completed',
        'rows_updated', v_rows_affected,
        'cashback_earned', v_cashback_earned,
        'cashback_skipped', v_cashback_skipped,
        'cashback_blocked_by_subscription', v_cashback_blocked_by_subscription,
        'subscription_covered_amount', v_sub_covered,
        'extra_amount', v_extra_amount,
        'income_amount', v_income_amount,
        'fully_covered_by_subscription', v_fully_covered,
        'payment_method', v_payment_method,
        'payment_status', v_payment_status,
        'log_created', v_log_created,
        'log_error', v_log_error
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE,
        'appointment_id', p_appointment_id
    );
END;
$function$;