DROP FUNCTION IF EXISTS public.cancel_appointment(uuid,text,text,text,uuid);

-- Função para cancelar agendamento com inteligência financeira
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT,
    p_source TEXT,
    p_refund_preference TEXT DEFAULT 'none',
    p_changed_by_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_appt RECORD;
    v_customer_id UUID;
    v_tenant_id UUID;
    v_credits_to_return NUMERIC(10,2);
    v_cashback_to_return NUMERIC(10,2);
    v_pix_paid NUMERIC(10,2);
BEGIN
    -- 1. Carregar agendamento
    SELECT * FROM public.appointments WHERE id = p_appointment_id INTO v_appt;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já cancelado');
    END IF;

    v_customer_id := v_appt.customer_id;
    v_tenant_id := v_appt.tenant_id;
    v_credits_to_return := COALESCE(v_appt.credits_used, v_appt.credit_used, 0);
    v_cashback_to_return := COALESCE(v_appt.cashback_used, 0);
    v_pix_paid := COALESCE(v_appt.pix_amount, 0);

    -- 2. Devolução Automática de Créditos Usados
    IF v_credits_to_return > 0 THEN
        INSERT INTO public.credit_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_credits_to_return, 'credit_refund', 'Devolução de crédito por cancelamento'
        );
    END IF;

    -- 3. Devolução Automática de Cashback Usado
    IF v_cashback_to_return > 0 THEN
        INSERT INTO public.cashback_transactions (
            tenant_id, customer_id, appointment_id, amount, type, description
        ) VALUES (
            v_tenant_id, v_customer_id, p_appointment_id, v_cashback_to_return, 'cashback_refund', 'Devolução de cashback por cancelamento'
        );
    END IF;

    -- 4. Tratar Valor Pago via PIX/Dinheiro/Cartão (v_pix_paid representa o valor real em caixa)
    IF v_pix_paid > 0 THEN
        IF p_refund_preference = 'credits' THEN
            -- Converter para crédito
            INSERT INTO public.credit_transactions (
                tenant_id, customer_id, appointment_id, amount, type, description
            ) VALUES (
                v_tenant_id, v_customer_id, p_appointment_id, v_pix_paid, 'credit_earned', 'Valor convertido de PIX por cancelamento'
            );
        ELSIF p_refund_preference = 'refund' THEN
            -- Criar solicitação de estorno
            INSERT INTO public.refund_requests (
                tenant_id, customer_id, appointment_id, amount, status, created_at
            ) VALUES (
                v_tenant_id, v_customer_id, p_appointment_id, v_pix_paid, 'requested', NOW()
            );
        END IF;
    END IF;

    -- 5. Atualizar Status do Agendamento
    UPDATE public.appointments
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 6. Cancelar Transação Financeira de Entrada (se existir)
    INSERT INTO public.transactions (
        user_id, tenant_id, appointment_id, barber_id, type, category, 
        amount, description, date
    ) VALUES (
        v_tenant_id, v_tenant_id, p_appointment_id, v_appt.barber_id, 'expense', 'Estorno',
        COALESCE(v_appt.total_price, 0), 'Cancelamento: ' || p_appointment_id, CURRENT_DATE
    );

    -- 7. Recalcular saldos
    PERFORM public.fn_recalculate_customer_balances(v_customer_id);

    RETURN jsonb_build_object('success', true, 'status_after', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
