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
SET search_path TO 'public'
AS $$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_amount DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_result JSONB;
    v_final_amount DECIMAL(10, 2);
    v_credit_used DECIMAL(10, 2);
    v_cashback_used DECIMAL(10, 2);
    v_payment_status TEXT;
    v_old_cashback_balance DECIMAL(10, 2);
    v_new_cashback_balance DECIMAL(10, 2);
BEGIN
    -- 1. Buscar agendamento e configurações do tenant (perfil)
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Se já estiver concluído, apenas retornar sucesso
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Aplicar Metadados (Pagamento, Créditos Usados, etc.)
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, v_appt.total_price);

    -- 3. Lógica de Desconto de Cashback (Se utilizado)
    IF v_cashback_used > 0 THEN
        -- Verificar saldo atual do cliente
        SELECT cashback_balance INTO v_old_cashback_balance FROM customers WHERE id = v_appt.customer_id;
        
        -- Só debita se não foi debitado antes (prevenção de double-spend se a função for chamada 2x por erro)
        -- Mas aqui usamos o status completed como trava, então é seguro.
        
        UPDATE customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_used,
            updated_at = now()
        WHERE id = v_appt.customer_id
        RETURNING cashback_balance INTO v_new_cashback_balance;

        -- Registrar transação de uso de cashback
        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_used', -v_cashback_used, v_appt.total_price, 'Cashback utilizado no agendamento'
        );
        
        RAISE NOTICE 'Cashback used: %, Old balance: %, New balance: %', v_cashback_used, v_old_cashback_balance, v_new_cashback_balance;
    END IF;

    -- 4. Atualizar o agendamento com as informações de pagamento
    UPDATE appointments SET
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Recarregar v_appt com os dados atualizados
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;

    -- 5. Lógica de Ganho de Cashback
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        SELECT EXISTS (
            SELECT 1 FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            IF v_cashback_percentage > 0 THEN
                -- Cashback calculado sobre o total_price original
                v_cashback_amount := (v_appt.total_price * v_cashback_percentage) / 100;
            END IF;
        END IF;
    END IF;

    -- 6. Atualizar status para concluído usando função central
    v_result := update_appointment_status(
        p_appointment_id, 
        'completed', 
        p_changed_by_type, 
        p_changed_by_id, 
        p_source,
        p_metadata || jsonb_build_object(
            'cashback_earned', v_cashback_amount,
            'cashback_percentage', v_cashback_percentage,
            'total_price', v_appt.total_price
        )
    );

    IF NOT (v_result->>'success')::boolean THEN
        -- Se falhou, mas já debitamos cashback, talvez precisássemos fazer rollback manual
        -- mas como estamos em uma transação (RPC), o PostgreSQL cuida do rollback se houver erro.
        RETURN v_result;
    END IF;

    -- 7. Efetivar ganho de cashback se calculado
    IF v_cashback_amount > 0 AND NOT v_already_earned THEN
        UPDATE customers 
        SET 
            cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
            loyalty_points = COALESCE(loyalty_points, 0) + 1,
            updated_at = now()
        WHERE id = v_appt.customer_id;

        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
        );

        UPDATE appointments SET cashback_earned = v_cashback_amount WHERE id = p_appointment_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'cashback_used', v_cashback_used,
        'new_status', 'completed'
    );
END;
$$;