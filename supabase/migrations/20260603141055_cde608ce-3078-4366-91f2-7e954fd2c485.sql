-- Corrigir função cancel_appointment para evitar erro de coluna amount_paid inexistente
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
SET search_path TO 'public'
AS $$
DECLARE
    v_appt RECORD;
    v_credits_to_refund DECIMAL(10, 2) := 0;
    v_pix_to_refund DECIMAL(10, 2) := 0;
    v_already_refunded BOOLEAN := FALSE;
    v_is_local_payment BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Este agendamento já foi cancelado', 'already_cancelled', true);
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamentos concluídos não podem ser cancelados');
    END IF;

    -- Verificação de pagamento local (Pagar na Barbearia)
    IF LOWER(COALESCE(v_appt.payment_method, '')) IN ('pay_at_shop', 'local', 'cash_on_site', 'pagar_na_barbearia', 'barbershop', 'in_person', 'cash') 
       OR COALESCE(v_appt.payment_status, 'pending') != 'paid' THEN
        v_is_local_payment := TRUE;
    END IF;

    IF NOT v_is_local_payment THEN
        -- Verificar se já houve estorno para evitar duplicidade
        SELECT EXISTS (
            SELECT 1 FROM credit_transactions 
            WHERE appointment_id = p_appointment_id AND type IN ('credit_refund', 'pix_to_credit')
        ) INTO v_already_refunded;

        IF NOT v_already_refunded THEN
            -- Créditos utilizados no agendamento (campo real na tabela appointments: credit_used ou credits_used)
            v_credits_to_refund := COALESCE(v_appt.credits_used, v_appt.credit_used, 0);

            -- Pagamento via PIX (campo real: final_amount ou total_price)
            IF (LOWER(v_appt.payment_method) = 'pix') AND v_appt.payment_status = 'paid' THEN
                -- Removida referência a amount_paid que causava erro
                v_pix_to_refund := COALESCE(v_appt.final_amount, v_appt.total_price, 0);
            END IF;

            -- Devolver créditos se houver
            IF v_credits_to_refund > 0 THEN
                UPDATE customers 
                SET credits = COALESCE(credits, 0) + v_credits_to_refund
                WHERE id = v_appt.customer_id;

                INSERT INTO credit_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'credit_refund', v_credits_to_refund, 'Estorno de créditos por cancelamento'
                );
            END IF;

            -- Processar estorno de PIX conforme preferência
            IF v_pix_to_refund > 0 THEN
                IF p_refund_preference = 'credit' THEN
                    UPDATE customers 
                    SET credits = COALESCE(credits, 0) + v_pix_to_refund
                    WHERE id = v_appt.customer_id;

                    INSERT INTO credit_transactions (
                        tenant_id, customer_id, appointment_id, type, amount, description
                    ) VALUES (
                        v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'pix_to_credit', v_pix_to_refund, 'Conversão de pagamento PIX em créditos por cancelamento'
                    );
                ELSIF p_refund_preference = 'refund' THEN
                    -- Registrar solicitação de reembolso se a tabela existir
                    INSERT INTO refund_requests (
                        tenant_id, customer_id, appointment_id, amount, payment_method, status, notes
                    ) VALUES (
                        v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_pix_to_refund, 'pix', 'pending', 'Solicitação via ' || p_source
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Atualizar status usando a função centralizada
    PERFORM update_appointment_status(
        p_appointment_id, 
        'cancelled', 
        p_cancelled_by, 
        p_changed_by_id, 
        p_source,
        jsonb_build_object(
            'refund_preference', p_refund_preference,
            'credits_refunded', v_credits_to_refund,
            'pix_refunded', v_pix_to_refund,
            'is_local_payment', v_is_local_payment,
            'payment_method', v_appt.payment_method
        )
    );

    -- Garantir que a data de cancelamento seja registrada se a coluna existir
    UPDATE appointments SET cancelled_at = now(), refund_preference = p_refund_preference WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'new_status', 'cancelled',
        'is_local_payment', v_is_local_payment,
        'credits_refunded', v_credits_to_refund,
        'pix_refunded', v_pix_to_refund
    );
END;
$$;

-- Corrigir função complete_appointment para evitar erro de v_tenant.settings inexistente
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text DEFAULT 'admin'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid, 
    p_source text DEFAULT 'system'::text
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
BEGIN
    -- 1. Buscar agendamento e configurações do tenant (perfil)
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Atualizar status para concluído usando função central
    v_result := update_appointment_status(
        p_appointment_id, 
        'completed', 
        p_changed_by_type, 
        p_changed_by_id, 
        p_source
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN v_result;
    END IF;

    -- 3. Lógica de Cashback
    -- Verificar se o cashback está habilitado no perfil (colunas reais: cashback_enabled, cashback_percentage)
    IF COALESCE(v_tenant.cashback_enabled, false) AND COALESCE(v_appt.payment_status, 'pending') = 'paid' THEN
        
        -- Verificar se já foi concedido cashback para este agendamento
        SELECT EXISTS (
            SELECT 1 FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            -- Usar a porcentagem do perfil (removido uso de v_tenant.settings->>'cashback_percentage')
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);

            IF v_cashback_percentage > 0 THEN
                v_cashback_amount := (v_appt.total_price * v_cashback_percentage) / 100;

                IF v_cashback_amount > 0 THEN
                    -- Atualizar saldo do cliente
                    UPDATE customers 
                    SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
                    WHERE id = v_appt.customer_id;

                    -- Registrar transação de cashback
                    INSERT INTO cashback_transactions (
                        tenant_id, customer_id, appointment_id, type, amount, base_amount, description
                    ) VALUES (
                        v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'new_status', 'completed'
    );
END;
$$;
