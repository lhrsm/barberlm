-- Add unique constraints to prevent duplicate credits
-- Note: payment_id might be NULL in some cases, but if it exists, it should be unique for credits.
-- However, multiple appointments could have different payment_ids for the same customer.
-- The most important is that one appointment or one specific payment shouldn't generate two credits.

-- First, clean up any potential duplicates before adding constraint (safe measure)
DELETE FROM public.customer_credits a
USING public.customer_credits b
WHERE a.id < b.id 
  AND (a.appointment_id = b.appointment_id OR (a.payment_id = b.payment_id AND a.payment_id IS NOT NULL));

-- Add unique constraints
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credits_appointment_id_key') THEN
        ALTER TABLE public.customer_credits ADD CONSTRAINT customer_credits_appointment_id_key UNIQUE (appointment_id);
    END IF;
END $$;

-- payment_id uniqueness is trickier because it could be NULL. 
-- We use a partial unique index instead.
CREATE UNIQUE INDEX IF NOT EXISTS customer_credits_payment_id_idx ON public.customer_credits (payment_id) WHERE payment_id IS NOT NULL;

-- Update convert_appointment_to_credit to handle these constraints gracefully
CREATE OR REPLACE FUNCTION public.convert_appointment_to_credit(
    p_appointment_id UUID,
    p_customer_id UUID,
    p_tenant_id UUID,
    p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appointment RECORD;
    v_credit_id UUID;
BEGIN
    -- 1. Lock the appointment to prevent concurrent updates
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- 2. Validate current status
    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- 3. Check for existing credit for this appointment
    IF EXISTS (SELECT 1 FROM customer_credits WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este agendamento');
    END IF;
    
    -- 4. Check for existing credit for this payment_id
    IF v_appointment.payment_id IS NOT NULL AND EXISTS (SELECT 1 FROM customer_credits WHERE payment_id = v_appointment.payment_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este ID de pagamento');
    END IF;

    -- 5. Create the credit record
    BEGIN
        INSERT INTO customer_credits (
            tenant_id,
            customer_id,
            appointment_id,
            payment_id,
            amount,
            status
        ) VALUES (
            p_tenant_id,
            p_customer_id,
            p_appointment_id,
            v_appointment.payment_id,
            p_amount,
            'available'
        ) RETURNING id INTO v_credit_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito duplicado detectado');
    END;

    -- 6. Update appointment
    UPDATE appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancel_source = 'customer_credit_conversion',
        refund_status = 'converted_to_credit',
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 7. Update customer balance
    UPDATE customers 
    SET credits = COALESCE(credits, 0) + p_amount
    WHERE id = p_customer_id;

    -- 8. Log the status change
    INSERT INTO appointment_status_logs (
        appointment_id,
        old_status,
        new_status,
        changed_by_type,
        source,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appointment.status,
        'cancelled',
        'customer',
        'public_link',
        jsonb_build_object(
            'action', 'convert_to_credit',
            'amount', p_amount,
            'credit_id', v_credit_id
        )
    );

    RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
END;
$$;

-- Create RPC to use credits for a new appointment
CREATE OR REPLACE FUNCTION public.use_customer_credits(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_appointment_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available_credits NUMERIC;
    v_credit_record RECORD;
    v_remaining_to_deduct NUMERIC := p_amount;
    v_deducted_total NUMERIC := 0;
BEGIN
    -- 1. Check total available credits
    SELECT COALESCE(credits, 0) INTO v_available_credits FROM customers WHERE id = p_customer_id FOR UPDATE;
    
    IF v_available_credits < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo de créditos insuficiente');
    END IF;

    -- 2. Deduct from customer_credits records (FIFO)
    FOR v_credit_record IN 
        SELECT id, available_amount 
        FROM customer_credits 
        WHERE customer_id = p_customer_id AND status IN ('available', 'partially_used')
        ORDER BY created_at ASC
    LOOP
        IF v_remaining_to_deduct <= 0 THEN
            EXIT;
        END IF;

        IF v_credit_record.available_amount <= v_remaining_to_deduct THEN
            -- Use full credit record
            UPDATE customer_credits 
            SET 
                used_amount = amount,
                status = 'used',
                updated_at = now()
            WHERE id = v_credit_record.id;
            
            v_remaining_to_deduct := v_remaining_to_deduct - v_credit_record.available_amount;
            v_deducted_total := v_deducted_total + v_credit_record.available_amount;
        ELSE
            -- Partial use of credit record
            UPDATE customer_credits 
            SET 
                used_amount = used_amount + v_remaining_to_deduct,
                status = 'partially_used',
                updated_at = now()
            WHERE id = v_credit_record.id;
            
            v_deducted_total := v_deducted_total + v_remaining_to_deduct;
            v_remaining_to_deduct := 0;
        END IF;
    END LOOP;

    -- 3. Update customer global balance
    UPDATE customers SET credits = credits - v_deducted_total WHERE id = p_customer_id;

    RETURN jsonb_build_object('success', true, 'deducted_amount', v_deducted_total);
END;
$$;