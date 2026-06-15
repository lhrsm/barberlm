
-- 1) Coluna loyalty_mode
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_mode text NOT NULL DEFAULT 'none'
  CHECK (loyalty_mode IN ('none','cashback','loyalty','subscription'));

-- Backfill a partir do estado atual
UPDATE public.profiles
SET loyalty_mode = CASE
  WHEN cashback_enabled = true THEN 'cashback'
  WHEN COALESCE(free_service_threshold, 0) > 0 THEN 'loyalty'
  ELSE 'none'
END
WHERE loyalty_mode = 'none';

-- 2) complete_appointment: cashback condicionado a loyalty_mode='cashback'
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
SET search_path TO 'public'
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
    v_loyalty_mode TEXT;
BEGIN
    SELECT * FROM public.appointments WHERE id = p_appointment_id INTO v_appt;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    v_customer_id := v_appt.customer_id;
    v_tenant_id   := v_appt.tenant_id;
    v_old_status  := COALESCE(v_appt.status, 'scheduled');

    SELECT * FROM public.profiles WHERE id = v_tenant_id INTO v_tenant;
    v_loyalty_mode := COALESCE(v_tenant.loyalty_mode, 'none');

    v_total_price   := COALESCE(v_appt.total_price, 0);
    v_credit_used   := COALESCE((p_metadata->>'credits_used')::numeric, v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_pix_amount    := COALESCE((p_metadata->>'pix_amount')::numeric, v_appt.pix_amount, 0);
    v_cash_amount   := COALESCE((p_metadata->>'cash_amount')::numeric, v_appt.cash_amount, 0);
    v_card_amount   := COALESCE(
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

    -- Cashback: SÓ se modo = cashback E habilitado E % > 0
    IF v_loyalty_mode = 'cashback'
       AND COALESCE(v_tenant.cashback_enabled, false) = true THEN
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
    ELSE
        -- Garante limpeza se houver registro espúrio para este agendamento
        DELETE FROM public.cashback_transactions
         WHERE appointment_id = p_appointment_id AND type IN ('earned','cashback_earned');
        UPDATE public.appointments SET cashback_earned = 0 WHERE id = p_appointment_id;
    END IF;

    -- Uso de crédito (idempotente) — independe do modo
    IF v_credit_used > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, type, amount, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, 'used', v_credit_used, 'Uso de crédito em agendamento'
        )
        ON CONFLICT (appointment_id) WHERE type IN ('used','credit_used') AND appointment_id IS NOT NULL
        DO UPDATE SET amount = EXCLUDED.amount;
    END IF;

    INSERT INTO public.appointment_status_logs (
        appointment_id, old_status, new_status, status_before, status_after,
        changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_old_status, 'completed', v_old_status, 'completed',
        COALESCE(p_changed_by_type,'admin'), p_changed_by_id, COALESCE(p_source,'system'),
        COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('loyalty_mode', v_loyalty_mode)
    );

    PERFORM public.recalculate_customer_credit_balance(v_customer_id);
    PERFORM public.recalculate_customer_cashback_balance(v_customer_id);

    RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id, 'loyalty_mode', v_loyalty_mode, 'cashback_earned', v_cashback_earned);
END;
$function$;

-- 3) handle_appointment_completion: fidelidade só se loyalty_mode='loyalty'
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
    v_loyalty_mode TEXT;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN

        -- Métricas financeiras do cliente (sempre)
        UPDATE public.customers
        SET total_spent = COALESCE(total_spent, 0) + COALESCE(NEW.total_price, 0),
            lifetime_value = COALESCE(lifetime_value, 0) + COALESCE(NEW.total_price, 0),
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = NEW.customer_id;

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
        v_loyalty_mode := COALESCE(v_profile.loyalty_mode, 'none');

        -- Fidelidade SÓ se modo = loyalty
        IF v_loyalty_mode = 'loyalty' THEN
            UPDATE public.customers
            SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
                updated_at = NOW()
            WHERE id = NEW.customer_id
            RETURNING loyalty_points INTO v_loyalty_points;

            IF v_loyalty_points >= COALESCE(v_profile.free_service_threshold, 10) THEN
                UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;
                v_loyalty_reward_value := COALESCE((v_profile.cashback_fixed_value)::numeric, 0);

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

                    PERFORM public.recalculate_customer_credit_balance(NEW.customer_id);
                END IF;
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$function$;

-- 4) Limpeza do registro espúrio do teste
DELETE FROM public.cashback_transactions
 WHERE appointment_id = '89194aff-08dc-4a64-b433-3c18f8276309';

UPDATE public.appointments
   SET cashback_earned = 0
 WHERE id = '89194aff-08dc-4a64-b433-3c18f8276309';

-- Recalcular todos os clientes afetados (idempotente, barato)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP
    PERFORM public.recalculate_customer_cashback_balance(r.id);
    PERFORM public.recalculate_customer_credit_balance(r.id);
  END LOOP;
END $$;
