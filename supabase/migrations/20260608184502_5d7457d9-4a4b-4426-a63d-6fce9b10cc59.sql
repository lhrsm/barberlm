-- Fix refund_requests columns if needed (already checked, but ensuring they are usable)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'refund_method') THEN
        ALTER TABLE public.refund_requests ADD COLUMN refund_method text;
    END IF;
END $$;

-- Update cancel_appointment function to be more robust and handle Pix logic correctly
CREATE OR REPLACE FUNCTION public.cancel_appointment(
    p_appointment_id uuid,
    p_cancelled_by text,
    p_source text,
    p_refund_preference text DEFAULT 'none',
    p_changed_by_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_appt RECORD;
    v_refund_id UUID;
    v_credit_id UUID;
    v_tenant_id UUID;
BEGIN
    -- 1. Fetch appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Prevent double cancellation
    IF v_appt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    v_tenant_id := v_appt.tenant_id;

    -- 3. Update appointment status
    UPDATE public.appointments
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancel_source = p_source,
        refund_preference = p_refund_preference,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 4. Log status change
    INSERT INTO public.appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        changed_by_id
    ) VALUES (
        p_appointment_id,
        v_appt.status,
        'cancelled',
        p_cancelled_by,
        p_source,
        p_changed_by_id
    );

    -- 5. Handle Refund Preference (if paid or Pix confirmed)
    -- Checking for both standard 'paid' status and 'pix' specifically if needed
    IF v_appt.payment_status IN ('paid', 'confirmed') THEN
        IF p_refund_preference = 'credits' THEN
            -- Create customer credit
            INSERT INTO public.customer_credits (
                tenant_id,
                customer_id,
                appointment_id,
                amount,
                status,
                credit_type,
                source_payment_id
            ) VALUES (
                v_tenant_id,
                v_appt.customer_id,
                p_appointment_id,
                COALESCE(v_appt.total_price, 0),
                'available',
                'refund',
                v_appt.payment_id
            ) RETURNING id INTO v_credit_id;

            -- Log financial transaction for credit
            INSERT INTO public.credit_transactions (
                customer_id,
                amount,
                transaction_type,
                description,
                appointment_id
            ) VALUES (
                v_appt.customer_id,
                COALESCE(v_appt.total_price, 0),
                'credit',
                'Crédito por cancelamento de agendamento: ' || p_appointment_id,
                p_appointment_id
            );

        ELSIF p_refund_preference = 'refund' THEN
            -- Create refund request
            INSERT INTO public.refund_requests (
                tenant_id,
                appointment_id,
                customer_id,
                amount,
                status,
                payment_method,
                payment_id,
                refund_method
            ) VALUES (
                v_tenant_id,
                p_appointment_id,
                v_appt.customer_id,
                COALESCE(v_appt.total_price, 0),
                'requested',
                COALESCE(v_appt.payment_method, 'pix'),
                v_appt.payment_id,
                'pix'
            ) RETURNING id INTO v_refund_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'credit_id', v_credit_id,
        'refund_id', v_refund_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Trigger to automatically update customer credits in the customers table when a new customer_credit is inserted
CREATE OR REPLACE FUNCTION public.sync_customer_credits() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'available' THEN
        UPDATE public.customers 
        SET credits = COALESCE(credits, 0) + NEW.amount
        WHERE id = NEW.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'available' AND NEW.status = 'available' THEN
            UPDATE public.customers 
            SET credits = COALESCE(credits, 0) + NEW.amount
            WHERE id = NEW.customer_id;
        ELSIF OLD.status = 'available' AND NEW.status != 'available' THEN
             UPDATE public.customers 
            SET credits = COALESCE(credits, 0) - OLD.amount
            WHERE id = OLD.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_customer_credits ON public.customer_credits;
CREATE TRIGGER tr_sync_customer_credits
AFTER INSERT OR UPDATE ON public.customer_credits
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_credits();
