-- 1. Ensure all management columns exist with safety checks
DO $$ 
BEGIN
    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='cancelled_at') THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='confirmed_at') THEN
        ALTER TABLE public.appointments ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='completed_at') THEN
        ALTER TABLE public.appointments ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;

    -- Actors & Sources
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='cancel_source') THEN
        ALTER TABLE public.appointments ADD COLUMN cancel_source TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='cancelled_by') THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='confirmed_by') THEN
        ALTER TABLE public.appointments ADD COLUMN confirmed_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='completed_by') THEN
        ALTER TABLE public.appointments ADD COLUMN completed_by TEXT;
    END IF;

    -- Preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='refund_preference') THEN
        ALTER TABLE public.appointments ADD COLUMN refund_preference TEXT;
    END IF;
END $$;

-- 2. Robust Status Update RPC
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
    -- Audit Load
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
    END IF;

    v_old_status := v_appointment.status;

    -- Dynamic Update to prevent errors if migration somehow partially failed
    EXECUTE format('
        UPDATE appointments 
        SET 
            status = $1,
            updated_at = now(),
            confirmed_at = CASE WHEN $1 = ''confirmed'' THEN now() ELSE confirmed_at END,
            confirmed_by = CASE WHEN $1 = ''confirmed'' THEN $2 ELSE confirmed_by END,
            completed_at = CASE WHEN $1 = ''completed'' THEN now() ELSE completed_at END,
            completed_by = CASE WHEN $1 = ''completed'' THEN $2 ELSE completed_by END,
            cancelled_at = CASE WHEN $1 = ''cancelled'' THEN now() ELSE cancelled_at END,
            cancelled_by = CASE WHEN $1 = ''cancelled'' THEN $2 ELSE cancelled_by END,
            cancel_source = CASE WHEN $1 = ''cancelled'' THEN $3 ELSE cancel_source END
        WHERE id = $4', p_new_status, p_changed_by_type, p_source, p_appointment_id)
    USING p_new_status, p_changed_by_type, p_source, p_appointment_id;

    -- Logging (Table already exists and was audited in previous turns)
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

-- 3. Robust Cancellation RPC
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
        -- Check for already processed refunds using standard credit_transactions table
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

    -- Update status using centralized function for consistency
    PERFORM update_appointment_status(
        p_appointment_id,
        'cancelled',
        p_cancelled_by,
        p_changed_by_id,
        p_source,
        jsonb_build_object(
            'refund_preference', p_refund_preference, 
            'credits_refunded', v_credits_to_refund,
            'is_local_payment', v_is_local_payment,
            'payment_method', v_appt.payment_method
        )
    );

    -- Extra safety to ensure refund_preference is updated if it exists
    UPDATE appointments SET refund_preference = p_refund_preference WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'credits_refunded', v_credits_to_refund, 
        'pix_refund_amount', v_pix_to_refund,
        'is_local_payment', v_is_local_payment
    );
END;
$$;
