-- 1. Add missing columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS cancel_source TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- 2. Re-update update_appointment_status to use these columns
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID,
    p_new_status TEXT,
    p_changed_by_type TEXT,
    p_changed_by_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'system',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_status TEXT;
    v_appointment RECORD;
BEGIN
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
    END IF;

    v_old_status := v_appointment.status;

    UPDATE appointments 
    SET 
        status = p_new_status,
        updated_at = now(),
        confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
        confirmed_by = CASE WHEN p_new_status = 'confirmed' THEN p_changed_by_type ELSE confirmed_by END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
        completed_by = CASE WHEN p_new_status = 'completed' THEN p_changed_by_type ELSE completed_by END,
        cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END,
        cancelled_by = CASE WHEN p_new_status = 'cancelled' THEN p_changed_by_type ELSE cancelled_by END,
        cancel_source = CASE WHEN p_new_status = 'cancelled' THEN p_source ELSE cancel_source END
    WHERE id = p_appointment_id;

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
        v_old_status,
        p_new_status,
        p_changed_by_type,
        p_changed_by_id,
        p_source,
        p_metadata
    );

    RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

-- 3. Re-update cancel_appointment (Redundant but ensures it's fresh with correct logic)
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

    -- Local payment check
    IF LOWER(COALESCE(v_appt.payment_method, '')) IN ('pay_at_shop', 'local', 'cash_on_site', 'pagar_na_barbearia', 'barbershop', 'in_person', 'cash') 
       OR v_appt.payment_status != 'paid' THEN
        v_is_local_payment := TRUE;
    END IF;

    IF NOT v_is_local_payment THEN
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
    END IF;

    -- Update status
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

    -- Log
    INSERT INTO appointment_status_logs (
        appointment_id, old_status, new_status, changed_by_type, changed_by_id, source, metadata
    ) VALUES (
        p_appointment_id, v_appt.status, 'cancelled', p_cancelled_by, p_changed_by_id, p_source, 
        jsonb_build_object(
            'refund_preference', p_refund_preference, 
            'credits_refunded', v_credits_to_refund,
            'is_local_payment', v_is_local_payment,
            'payment_method', v_appt.payment_method
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'credits_refunded', v_credits_to_refund, 
        'pix_refund_amount', v_pix_to_refund,
        'is_local_payment', v_is_local_payment
    );
END;
$$;
