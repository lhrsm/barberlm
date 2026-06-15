
-- Bloqueia cashback e fidelidade tradicional quando a assinatura cobre o atendimento.
-- Cashback é calculado apenas sobre o valor NÃO coberto pela assinatura (extra_amount).
-- Ponto de fidelidade tradicional NÃO é gerado quando o atendimento está totalmente coberto.

-- 1) Trigger de fidelidade: não incrementa pontos quando totalmente coberto pela assinatura
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_profile RECORD;
    v_loyalty_points INTEGER;
    v_loyalty_reward_value NUMERIC(10,2);
    v_credits_used NUMERIC(10,2);
    v_cashback_used NUMERIC(10,2);
    v_sub_covered NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    v_fully_covered BOOLEAN;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN

        v_sub_covered := COALESCE(NEW.subscription_covered_amount, 0);
        v_total_price := COALESCE(NEW.total_price, 0);
        v_fully_covered := (NEW.subscription_id IS NOT NULL AND v_sub_covered > 0 AND v_sub_covered >= v_total_price);

        -- Métricas básicas sempre atualizadas
        UPDATE public.customers
        SET total_spent = COALESCE(total_spent, 0) + v_total_price,
            lifetime_value = COALESCE(lifetime_value, 0) + v_total_price,
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = NEW.customer_id;

        -- Pontos de fidelidade tradicional: BLOQUEADOS quando totalmente coberto pela assinatura
        IF NOT v_fully_covered THEN
            UPDATE public.customers
            SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
                updated_at = NOW()
            WHERE id = NEW.customer_id
            RETURNING loyalty_points INTO v_loyalty_points;
        ELSE
            SELECT loyalty_points INTO v_loyalty_points FROM public.customers WHERE id = NEW.customer_id;
        END IF;

        v_credits_used := COALESCE(NEW.credits_used, NEW.credit_used, 0);
        v_cashback_used := COALESCE(NEW.cashback_used, 0);

        IF v_credits_used > 0 OR v_cashback_used > 0 THEN
            UPDATE public.customers
            SET credits_used = COALESCE(credits_used, 0) + v_credits_used,
                cashback_used = COALESCE(cashback_used, 0) + v_cashback_used,
                updated_at = NOW()
            WHERE id = NEW.customer_id;
        END IF;

        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- Prêmio de fidelidade (créditos) só dispara se houve incremento de ponto
        IF NOT v_fully_covered AND v_loyalty_points >= COALESCE(v_profile.free_service_threshold, 10) THEN
            UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;
            v_loyalty_reward_value := COALESCE(v_profile.loyalty_reward_value, 10.00);

            IF v_loyalty_reward_value > 0 THEN
                INSERT INTO public.customer_credits (
                    tenant_id, customer_id, appointment_id, amount, used_amount, status, credit_type, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, v_loyalty_reward_value, 0, 'available', 'loyalty', 'Prêmio de Fidelidade'
                );

                INSERT INTO public.credit_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', v_loyalty_reward_value, 'Crédito de fidelidade concedido'
                );

                UPDATE public.customers
                SET credits = COALESCE(credits, 0) + v_loyalty_reward_value,
                    updated_at = NOW()
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 2) RPC complete_appointment: cashback calculado apenas sobre o valor não coberto pela assinatura
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text DEFAULT 'system'::text,
    p_changed_by_id uuid DEFAULT NULL::uuid,
    p_source text DEFAULT 'rpc'::text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
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

    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    IF v_final_amount = 0 AND v_total_price > 0 THEN
        v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used - v_sub_covered);
        IF v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0 THEN
             v_pix_amount := v_final_amount;
        END IF;
    END IF;

    -- Cashback: base = total - coberto pela assinatura. Se totalmente coberto, NÃO gera cashback.
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    v_cashbackable_base := GREATEST(0, v_total_price - v_sub_covered);

    IF v_appt.subscription_id IS NOT NULL AND v_sub_covered >= v_total_price AND v_total_price > 0 THEN
        v_cashback_blocked_by_subscription := true;
        v_cashback_earned := 0;
    ELSIF v_cashback_percentage > 0 AND v_cashbackable_base > 0 THEN
        v_cashback_earned := (v_cashbackable_base * v_cashback_percentage) / 100;
        IF v_sub_covered > 0 THEN
            v_cashback_blocked_by_subscription := true; -- parcial: bloqueio sobre a parte coberta
        END IF;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.transactions WHERE appointment_id = p_appointment_id) INTO v_existing_trans;

    IF NOT v_existing_trans THEN
        v_description := 'Atendimento: ' || COALESCE(v_appt.service_name, 'Serviço') || ' - ' || COALESCE(v_appt.customer_name, 'Cliente');

        INSERT INTO public.transactions (
            user_id, tenant_id, appointment_id, barber_id, type, category,
            amount, pix_amount, cash_amount, credit_card_amount,
            credits_amount, cashback_amount, payment_method,
            description, date, payment_breakdown
        ) VALUES (
            v_appt.tenant_id, v_appt.tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
            v_total_price, v_pix_amount, v_cash_amount, v_card_amount,
            v_credit_used, v_cashback_used, COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix'),
            v_description, CURRENT_DATE,
            jsonb_build_object(
                'pix', v_pix_amount,
                'cash', v_cash_amount,
                'card', v_card_amount,
                'credits', v_credit_used,
                'cashback', v_cashback_used,
                'subscription_covered', v_sub_covered
            )
        );
    END IF;

    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, type, description, status
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, 'earned',
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço') ||
                CASE WHEN v_sub_covered > 0 THEN ' (apenas valor extra)' ELSE '' END,
                'completed'
            ) RETURNING id INTO v_cashback_tx_id;

            UPDATE public.customers
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    UPDATE public.appointments
    SET
        status = 'completed',
        completed_at = now(),
        updated_at = now(),
        cashback_earned = v_cashback_earned,
        payment_method = COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix'),
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
                'total_price', v_total_price,
                'final_amount', v_final_amount
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
$$;
