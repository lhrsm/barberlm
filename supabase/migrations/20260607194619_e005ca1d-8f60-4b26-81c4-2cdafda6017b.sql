-- Update convert_appointment_to_credit
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
    -- Select with row-level lock
    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    IF v_appointment.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento já está cancelado');
    END IF;

    -- Extra safety: check if this specific appointment has already been converted
    IF v_appointment.refund_status = 'converted_to_credit' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi convertido em crédito');
    END IF;

    -- Double check in customer_credits table by appointment_id
    IF EXISTS (SELECT 1 FROM customer_credits WHERE appointment_id = p_appointment_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito já gerado para este agendamento');
    END IF;

    -- 1. Create the credit record
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

    -- 2. Update the appointment status and source
    UPDATE appointments 
    SET 
        status = 'cancelled',
        cancelled_at = now(),
        cancel_source = 'customer_credit_conversion',
        refund_status = 'converted_to_credit',
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 3. Update the global credit balance on customer record
    UPDATE customers 
    SET 
        credits = COALESCE(credits, 0) + p_amount,
        updated_at = now()
    WHERE id = p_customer_id;

    -- 4. Log status change
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
            'credit_id', v_credit_id,
            'payment_id', v_appointment.payment_id
        )
    );

    RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update use_customer_credits with fixed loop syntax
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
    -- 1. Check total available credits with row-level lock
    SELECT COALESCE(credits, 0) INTO v_available_credits FROM customers WHERE id = p_customer_id FOR UPDATE;
    
    IF v_available_credits < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo de créditos insuficiente');
    END IF;

    -- 2. Deduct from customer_credits records (FIFO)
    FOR v_credit_record IN 
        SELECT id, amount, used_amount, available_amount 
        FROM customer_credits 
        WHERE customer_id = p_customer_id AND status IN ('available', 'partially_used')
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining_to_deduct <= 0 THEN
            EXIT;
        END IF;

        IF v_credit_record.available_amount <= v_remaining_to_deduct THEN
            -- Use full record
            UPDATE customer_credits 
            SET 
                used_amount = amount,
                status = 'used',
                updated_at = now()
            WHERE id = v_credit_record.id;
            
            v_remaining_to_deduct := v_remaining_to_deduct - v_credit_record.available_amount;
            v_deducted_total := v_deducted_total + v_credit_record.available_amount;
        ELSE
            -- Use partial record
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

    -- 3. Update the global credit balance on customer record
    UPDATE customers 
    SET 
        credits = credits - p_amount,
        updated_at = now()
    WHERE id = p_customer_id;

    RETURN jsonb_build_object('success', true, 'deducted', p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;