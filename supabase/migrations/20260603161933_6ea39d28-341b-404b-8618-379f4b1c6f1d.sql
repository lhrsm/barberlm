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
    -- Extrair valores do metadata ou manter os atuais
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, v_appt.total_price);

    -- Atualizar o agendamento com as informações de pagamento ANTES de calcular o novo cashback
    UPDATE appointments SET
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Recarregar v_appt com os dados atualizados
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;

    -- 3. Lógica de Cashback
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        -- Verificar se já ganhou cashback para este agendamento
        SELECT EXISTS (
            SELECT 1 FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            IF v_cashback_percentage > 0 THEN
                -- O cashback é calculado sobre o valor real pago (final_amount) ou sobre o total?
                -- Normalmente é sobre o que o cliente efetivamente pagou ou sobre o total do serviço.
                -- Vamos seguir a lógica de que é sobre o total_price original do serviço.
                v_cashback_amount := (v_appt.total_price * v_cashback_percentage) / 100;
            END IF;
        END IF;
    END IF;

    -- 4. Atualizar status para concluído usando função central
    -- Mesclamos o metadata original com os dados de cashback calculados
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
        RETURN v_result;
    END IF;

    -- 5. Efetivar cashback se calculado
    IF v_cashback_amount > 0 AND NOT v_already_earned THEN
        -- Incrementar o saldo do cliente
        UPDATE customers 
        SET 
            cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
            loyalty_points = COALESCE(loyalty_points, 0) + 1,
            updated_at = now()
        WHERE id = v_appt.customer_id;

        -- Registrar a transação
        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
        );

        -- Também registrar o cashback_earned no agendamento para fins de histórico
        UPDATE appointments SET cashback_earned = v_cashback_amount WHERE id = p_appointment_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'new_status', 'completed'
    );
END;
$$;