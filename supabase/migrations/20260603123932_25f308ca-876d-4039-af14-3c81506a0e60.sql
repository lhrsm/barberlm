-- Update the cancel_appointment function to handle "Pay at Shop" variants
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by TEXT,
    p_source TEXT,
    p_refund_preference TEXT DEFAULT 'none',
    p_changed_by_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt RECORD;
    v_credits_to_refund DECIMAL(10, 2) := 0;
    v_pix_to_refund DECIMAL(10, 2) := 0;
    v_already_refunded BOOLEAN := FALSE;
    v_cashback_to_reverse DECIMAL(10, 2) := 0;
    v_is_local_payment BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch appointment
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Check current status
    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Este agendamento já foi cancelado', 'already_cancelled', true);
    END IF;

    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamentos concluídos não podem ser cancelados');
    END IF;

    -- 3. Determine if it is a local payment method
    -- pay_at_shop, local, cash_on_site, pagar_na_barbearia, barbershop, in_person, cash
    IF LOWER(v_appt.payment_method) IN ('pay_at_shop', 'local', 'cash_on_site', 'pagar_na_barbearia', 'barbershop', 'in_person', 'cash') 
       OR v_appt.payment_status != 'paid' THEN
        v_is_local_payment := TRUE;
    END IF;

    -- 4. Financial logic (only if NOT local payment or if credits were used)
    -- Even if local payment, if they used credits (partial payment), they should probably get them back?
    -- The user message says "Não gerar crédito. Não alterar saldo do cliente" for local payments.
    -- I will follow this: if it is local payment OR unpaid, skip refund logic.
    
    IF NOT v_is_local_payment THEN
        -- Check if already refunded
        SELECT EXISTS (
            SELECT 1 FROM credit_transactions 
            WHERE appointment_id = p_appointment_id AND type IN ('credit_refund', 'pix_to_credit')
        ) INTO v_already_refunded;

        IF NOT v_already_refunded THEN
            v_credits_to_refund := COALESCE(v_appt.credit_used, 0);
            
            IF (LOWER(v_appt.payment_method) = 'pix') AND v_appt.payment_status = 'paid' THEN
                v_pix_to_refund := COALESCE(v_appt.amount_paid, v_appt.final_amount, v_appt.total_price, 0);
            END IF;

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
                    INSERT INTO refund_requests (
                        tenant_id, customer_id, appointment_id, amount, payment_method, status, notes
                    ) VALUES (
                        v_appt.tenant_id, v_appt.customer_id, p_appointment_id, v_pix_to_refund, 'pix', 'pending', 'Solicitação via ' || p_source
                    );
                END IF;
            END IF;
        END IF;

        -- Cashback Reversal if was completed (though completed check above blocks this usually)
        IF v_appt.status = 'completed' THEN
            SELECT SUM(amount) INTO v_cashback_to_reverse FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned';
            
            IF v_cashback_to_reverse > 0 THEN
                 UPDATE customers 
                 SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - v_cashback_to_reverse)
                 WHERE id = v_appt.customer_id;

                 INSERT INTO cashback_transactions (
                    tenant_id, customer_id, appointment_id, type, amount, description
                ) VALUES (
                    v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_reversed', -v_cashback_to_reverse, 'Estorno de cashback por cancelamento'
                );
            END IF;
        END IF;
    END IF;

    -- 5. Update appointment status
    UPDATE appointments 
    SET 
        status = 'cancelled',
        payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'cancelled' END,
        updated_at = now(),
        cancelled_at = now(),
        cancel_source = p_source,
        cancelled_by = p_cancelled_by,
        refund_preference = p_refund_preference
    WHERE id = p_appointment_id;

    -- 6. Log status change
    INSERT INTO appointment_status_logs (
        appointment_id, 
        old_status, 
        new_status, 
        changed_by_type, 
        changed_by_id, 
        source, 
        metadata
    ) VALUES (
        p_appointment_id, 
        v_appt.status, 
        'cancelled', 
        p_cancelled_by, 
        p_changed_by_id, 
        p_source, 
        jsonb_build_object(
            'refund_preference', p_refund_preference, 
            'credits_refunded', v_credits_to_refund,
            'payment_method', v_appt.payment_method,
            'payment_status', v_appt.payment_status,
            'is_local_payment', v_is_local_payment
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'credits_refunded', v_credits_to_refund, 
        'pix_refund_amount', v_pix_to_refund,
        'cashback_reversed', v_cashback_to_reverse,
        'is_local_payment', v_is_local_payment
    );
END;
$$;
