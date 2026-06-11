-- 1. Atualizar o trigger para remover a geração de cashback
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
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- A. Incrementar pontos de fidelidade e métricas
        UPDATE public.customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1,
            total_spent = COALESCE(total_spent, 0) + COALESCE(NEW.total_price, 0),
            lifetime_value = COALESCE(lifetime_value, 0) + COALESCE(NEW.total_price, 0),
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = NEW.customer_id
        RETURNING loyalty_points INTO v_loyalty_points;

        -- B. Registrar uso histórico de Créditos e Cashback nas métricas do cliente
        v_credits_used := COALESCE(NEW.credits_used, NEW.credit_used, 0);
        v_cashback_used := COALESCE(NEW.cashback_used, 0);

        IF v_credits_used > 0 OR v_cashback_used > 0 THEN
            UPDATE public.customers
            SET credits_used = COALESCE(credits_used, 0) + v_credits_used,
                cashback_used = COALESCE(cashback_used, 0) + v_cashback_used,
                updated_at = NOW()
            WHERE id = NEW.customer_id;
        END IF;

        -- C. Carregar configurações do tenant
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- D. Regra de Fidelidade (Bônus a cada X atendimentos)
        IF v_loyalty_points >= COALESCE(v_profile.free_service_threshold, 10) THEN
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

        -- E. Cashback removido deste trigger para evitar duplicidade com a RPC complete_appointment
        -- Conforme solicitado, a RPC passa a ser a única fonte de geração de cashback.
        
    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Redefinir a RPC complete_appointment com melhorias e logs
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text, 
    p_changed_by_id uuid, 
    p_source text, 
    p_metadata jsonb DEFAULT '{}'::jsonb
)
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
    v_cashback_earned NUMERIC(10,2) := 0;
    v_cashback_percentage NUMERIC;
    v_existing_cashback BOOLEAN;
    v_existing_trans BOOLEAN;
    v_rows_affected INTEGER;
    v_status_before TEXT;
    v_description TEXT;
    v_cashback_tx_id UUID;
    v_cashback_skipped BOOLEAN := false;
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
        -- Se não informou detalhamento, assume PIX por padrão ou o que já estava
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
        -- Verifica qualquer tipo de transação de cashback para este agendamento que seja crédito
        SELECT id FROM public.cashback_transactions 
        WHERE appointment_id = p_appointment_id 
        AND type IN ('earned', 'cashback_earned', 'credit')
        LIMIT 1 INTO v_cashback_tx_id;

        IF v_cashback_tx_id IS NULL THEN
            INSERT INTO public.cashback_transactions (
                tenant_id, customer_id, appointment_id, type, amount, base_amount, description
            ) VALUES (
                v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit', 
                v_cashback_earned, v_total_price, 'Cashback gerado no atendimento ' || COALESCE(v_appt.service_name, '')
            ) ON CONFLICT (appointment_id) DO NOTHING
            RETURNING id INTO v_cashback_tx_id;
            
            IF v_cashback_tx_id IS NOT NULL THEN
                -- Atualizar saldo do cliente APENAS se inseriu com sucesso
                UPDATE public.customers 
                SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_earned,
                    updated_at = NOW()
                WHERE id = v_appt.customer_id;
            ELSE
                v_cashback_skipped := true;
                -- Se não retornou ID no INSERT (DO NOTHING), buscamos o existente
                SELECT id FROM public.cashback_transactions WHERE appointment_id = p_appointment_id LIMIT 1 INTO v_cashback_tx_id;
            END IF;
        ELSE
            v_cashback_skipped := true;
        END IF;
    END IF;

    -- 6. Debitar Créditos/Cashback usados (Se houver e se não foi feito via trigger)
    -- NOTA: O trigger handle_appointment_completion já faz os updates de lifetime_value e total_spent.
    -- Debitar saldos
    IF v_credit_used > 0 THEN
        UPDATE public.customers 
        SET credits = GREATEST(0, COALESCE(credits, 0) - v_credit_used),
            updated_at = NOW()
        WHERE id = v_appt.customer_id;
    END IF;

    IF v_cashback_used > 0 THEN
        UPDATE public.customers 
        SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - v_cashback_used),
            updated_at = NOW()
        WHERE id = v_appt.customer_id;
    END IF;

    -- 7. Atualizar agendamento para concluído
    UPDATE public.appointments 
    SET status = 'completed',
        completed_at = NOW(),
        payment_status = 'paid',
        payment_method = COALESCE(p_metadata->>'payment_method', v_appt.payment_method, 'pix'),
        pix_amount = v_pix_amount,
        cash_amount = v_cash_amount,
        credit_card_amount = v_card_amount,
        credits_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- 8. Registrar Log de Status
    INSERT INTO public.appointment_status_logs (
        appointment_id, status_before, status_after, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_status_before, 'completed', p_changed_by_type, p_changed_by_id, p_source, p_metadata
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'status_before', v_status_before,
        'status_after', 'completed',
        'rows_updated', v_rows_affected,
        'cashback_earned', v_cashback_earned,
        'cashback_transaction_id', v_cashback_tx_id,
        'cashback_already_exists', v_cashback_skipped,
        'cashback_generator_source', 'rpc_complete_appointment'
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
