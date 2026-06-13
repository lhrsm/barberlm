
-- ============================================================
-- FASE 1 — Fonte única da verdade no financeiro
-- ============================================================

-- 1. Remover triggers duplicados / concorrentes
DROP TRIGGER IF EXISTS trigger_on_appointment_pix_paid ON public.appointments;
DROP TRIGGER IF EXISTS tr_enqueue_new_appointment_update ON public.appointments;

-- 2. Remover funções órfãs / duplicadas
DROP FUNCTION IF EXISTS public.register_pix_payment_transaction(uuid);
DROP FUNCTION IF EXISTS public.handle_appointment_payment_update();
DROP FUNCTION IF EXISTS public.trigger_cashback_event();
DROP FUNCTION IF EXISTS public.handle_payment_success(uuid, text);
DROP FUNCTION IF EXISTS public.update_appointment_status(uuid, text, text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.cancel_appointment_by_token(uuid);

-- 3. Garantir índice único para ON CONFLICT em credit_transactions (uso por agendamento)
CREATE UNIQUE INDEX IF NOT EXISTS unique_credit_used_per_appointment
  ON public.credit_transactions(appointment_id)
  WHERE type IN ('used', 'credit_used') AND appointment_id IS NOT NULL;

-- 4. Manter apenas UMA versão de cancel_appointment (a nova, com 5 args)
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid, uuid, text, text);

-- 5. Reescrever complete_appointment como única fonte de lançamento financeiro
--    (já existia, mas garantimos a forma idempotente, com log sempre preenchido e
--     sem dependência de register_pix_payment_transaction)
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid,
    p_changed_by_type text DEFAULT 'admin',
    p_changed_by_id uuid DEFAULT auth.uid(),
    p_source text DEFAULT 'system',
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_customer_id UUID;
    v_tenant_id UUID;
    v_old_status TEXT;
BEGIN
    SELECT * FROM public.appointments WHERE id = p_appointment_id INTO v_appt;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_customer_id := v_appt.customer_id;
    v_tenant_id := v_appt.tenant_id;
    v_old_status := COALESCE(v_appt.status, 'scheduled');

    SELECT * FROM public.profiles WHERE id = v_tenant_id INTO v_tenant;

    v_total_price := COALESCE(v_appt.total_price, 0);
    v_credit_used := COALESCE((p_metadata->>'credits_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount := COALESCE(
        (p_metadata->>'credit_card_amount')::numeric,
        (p_metadata->>'debit_card_amount')::numeric,
        v_appt.credit_card_amount, v_appt.debit_card_amount, 0
    );

    IF (v_pix_amount + v_cash_amount + v_card_amount) = 0 AND v_total_price > 0 THEN
        v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used);
        v_pix_amount := v_final_amount;
    ELSE
        v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    END IF;

    UPDATE public.appointments
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        completed_by = COALESCE(completed_by, p_changed_by_id::text),
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        credits_used = v_credit_used,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        final_amount = v_final_amount,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- Lançamento financeiro idempotente (única fonte)
    INSERT INTO public.transactions (
        user_id, tenant_id, appointment_id, barber_id, type, category,
        amount, pix_amount, cash_amount, credit_card_amount,
        credits_amount, cashback_amount, payment_method,
        description, date, payment_breakdown
    ) VALUES (
        v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'income', 'Serviço',
        v_total_price, v_pix_amount, v_cash_amount, v_card_amount,
        v_credit_used, v_cashback_used,
        COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'mixed'),
        'Conclusão: ' || p_appointment_id::text, CURRENT_DATE,
        jsonb_build_object('pix', v_pix_amount, 'cash', v_cash_amount, 'card', v_card_amount, 'credits', v_credit_used, 'cashback', v_cashback_used)
    )
    ON CONFLICT (appointment_id) WHERE type = 'income' AND appointment_id IS NOT NULL
    DO UPDATE SET
        amount = EXCLUDED.amount,
        pix_amount = EXCLUDED.pix_amount,
        cash_amount = EXCLUDED.cash_amount,
        credit_card_amount = EXCLUDED.credit_card_amount,
        credits_amount = EXCLUDED.credits_amount,
        cashback_amount = EXCLUDED.cashback_amount,
        payment_method = EXCLUDED.payment_method,
        payment_breakdown = EXCLUDED.payment_breakdown,
        updated_at = NOW();

    -- Cashback (idempotente)
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    IF v_cashback_percentage > 0 AND v_final_amount > 0 THEN
        v_cashback_earned := (v_final_amount * v_cashback_percentage) / 100;
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_earned, 'earned', 'Cashback sobre serviço'
        )
        ON CONFLICT (appointment_id) DO UPDATE SET amount = EXCLUDED.amount;
        UPDATE public.appointments SET cashback_earned = v_cashback_earned WHERE id = p_appointment_id;
    END IF;

    -- Uso de crédito (idempotente)
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, 'used', v_credit_used, 'Uso de crédito em agendamento'
        )
        ON CONFLICT (appointment_id) WHERE type IN ('used','credit_used') AND appointment_id IS NOT NULL
        DO UPDATE SET amount = EXCLUDED.amount;
    END IF;

    -- Log de status (new_status sempre preenchido)
    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_old_status, 'completed', v_old_status, 'completed',
        COALESCE(p_changed_by_type,'admin'), p_changed_by_id, COALESCE(p_source,'system'), COALESCE(p_metadata,'{}'::jsonb)
    );

    -- Recalcular saldos via funções únicas
    PERFORM public.recalculate_customer_credit_balance(v_customer_id);
    PERFORM public.recalculate_customer_cashback_balance(v_customer_id);

    RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$function$;

-- 6. Remover recalculadores duplicados (consolidando em recalculate_customer_credit_balance / cashback)
DROP FUNCTION IF EXISTS public.fn_recalculate_customer_balances(uuid);
DROP FUNCTION IF EXISTS public.recalculate_customer_stats(uuid, uuid);
