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
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_existing_cashback BOOLEAN;
    v_existing_trans BOOLEAN;
    v_rows_affected INTEGER;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
    v_log_created BOOLEAN := false;
    v_log_error TEXT;
BEGIN
    -- 1. Buscar agendamento e validar
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

    -- 2. Buscar configurações do tenant (Profiles)
    SELECT * FROM public.profiles WHERE id = v_appt.tenant_id INTO v_tenant;

    -- 3. Extração de valores (Prioridade: Metadata > Agendamento)
    v_total_price := COALESCE(v_appt.total_price, 0);
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
    
    -- Lógica de Normalização de Valores
    v_final_amount := v_pix_amount + v_cash_amount + v_card_amount;
    IF v_final_amount = 0 AND v_total_price > 0 THEN
        v_final_amount := GREATEST(0, v_total_price - v_credit_used - v_cashback_used);
        IF v_pix_amount = 0 AND v_cash_amount = 0 AND v_card_amount = 0 THEN
             v_pix_amount := v_final_amount;
        END IF;
    END IF;

    -- Cálculo do Cashback
    v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
    IF v_cashback_percentage > 0 THEN
        v_cashback_earned := (v_total_price * v_cashback_percentage) / 100;
    END IF;
    
    -- 4. Registrar transação financeira (Entrada Real em Caixa)
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
                'cashback', v_cashback_used
            )
        );
    END IF;

    -- 5. Processar Cashback (Geração de novo saldo) - IDEMPOTENTE
    IF v_cashback_earned > 0 THEN
        SELECT id FROM public.cashback_transactions 
        WHERE appointment_id = p_appointment_id INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                customer_id, tenant_id, appointment_id, amount, type, description, status
            ) VALUES (
                v_appt.customer_id, v_appt.tenant_id, p_appointment_id, v_cashback_earned, 'earned', 
                'Cashback: ' || COALESCE(v_appt.service_name, 'Serviço'), 'completed'
            ) RETURNING id INTO v_cashback_tx_id;
            
            -- Atualiza saldo do cliente
            UPDATE public.customers 
            SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                updated_at = now()
            WHERE id = v_appt.customer_id;
        END IF;
    ELSE
        v_cashback_skipped := true;
    END IF;

    -- 6. Atualizar Agendamento Principal
    UPDATE public.appointments
    SET 
        status = 'completed',
        completed_at = now(),
        updated_at = now(),
        cashback_earned = v_cashback_earned, -- Garante preenchimento do campo
        payment_method = COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix'),
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount
    WHERE id = p_appointment_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- 7. Log de Auditoria (Audit Log)
    BEGIN
        INSERT INTO public.appointment_status_logs (
            appointment_id, 
            old_status, 
            new_status, 
            status_before, 
            status_after,
            changed_by_type, 
            changed_by_id, 
            source, 
            metadata
        ) VALUES (
            p_appointment_id, 
            v_status_before, 
            'completed', 
            v_status_before, 
            'completed',
            p_changed_by_type, 
            p_changed_by_id, 
            p_source, 
            p_metadata || jsonb_build_object(
                'cashback_earned', v_cashback_earned,
                'cashback_tx_id', v_cashback_tx_id,
                'total_price', v_total_price,
                'final_amount', v_final_amount
            )
        );
        v_log_created := true;
    EXCEPTION WHEN OTHERS THEN
        v_log_error := SQLERRM;
        -- We don't fail the whole transaction if logging fails
    END;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'status_before', v_status_before,
        'status_after', 'completed',
        'rows_updated', v_rows_affected,
        'cashback_earned', v_cashback_earned,
        'cashback_skipped', v_cashback_skipped,
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

CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid,
    p_cancelled_by uuid,
    p_source text DEFAULT 'customer'::text,
    p_refund_preference text DEFAULT 'credits'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
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
            WHEN p_refund_preference = 'credits' THEN 'completed'
            ELSE 'pending'
        END,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Log
    BEGIN
        INSERT INTO public.appointment_status_logs (
            appointment_id, 
            old_status, 
            new_status, 
            status_before, 
            status_after,
            changed_by_type, 
            changed_by_id, 
            source, 
            metadata
        ) VALUES (
            p_appointment_id, 
            v_status_before, 
            'cancelled', 
            v_status_before, 
            'cancelled',
            p_source, 
            p_cancelled_by, 
            p_source, 
            jsonb_build_object(
                'refund_preference', p_refund_preference,
                'pix_refund_amount', CASE WHEN v_is_pix_paid THEN v_pix_amount ELSE 0 END,
                'credits_reverted', v_credits_used,
                'cashback_reverted', v_cashback_used
            )
        );
        v_log_created := true;
    EXCEPTION WHEN OTHERS THEN
        v_log_error := SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'refund_id', v_refund_id,
        'log_created', v_log_created,
        'log_error', v_log_error
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
    p_appointment_id uuid,
    p_new_start_time timestamp with time zone,
    p_new_end_time timestamp with time zone,
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
  v_appointment record;
  v_old_start timestamp with time zone;
  v_old_end timestamp with time zone;
  v_log_created boolean := false;
  v_log_error text;
BEGIN
  -- 1. Fetch current appointment
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- 2. Validations
  IF v_appointment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento cancelado');
  END IF;

  IF v_appointment.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar um agendamento já concluído');
  END IF;

  v_old_start := v_appointment.start_time;
  v_old_end := v_appointment.end_time;

  -- 3. Update appointment
  UPDATE public.appointments 
  SET 
    start_time = p_new_start_time,
    end_time = p_new_end_time,
    updated_at = now(),
    updated_by_type = p_changed_by_type,
    updated_by_id = p_changed_by_id,
    customer_action_source = CASE WHEN p_changed_by_type = 'customer' THEN p_source ELSE customer_action_source END
  WHERE id = p_appointment_id;

  -- 4. Log change
  BEGIN
      INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        status_before,
        status_after,
        changed_by_type,
        changed_by_id,
        source,
        metadata
      ) VALUES (
        p_appointment_id,
        v_appointment.status,
        v_appointment.status, -- status remains the same
        v_appointment.status,
        v_appointment.status,
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata || jsonb_build_object(
          'action', 'reschedule',
          'old_start', v_old_start,
          'new_start', p_new_start_time,
          'old_end', v_old_end,
          'new_end', p_new_end_time
        )
      );
      v_log_created := true;
  EXCEPTION WHEN OTHERS THEN
      v_log_error := SQLERRM;
  END;

  RETURN jsonb_build_object(
      'success', true,
      'log_created', v_log_created,
      'log_error', v_log_error
  );
END;
$$;