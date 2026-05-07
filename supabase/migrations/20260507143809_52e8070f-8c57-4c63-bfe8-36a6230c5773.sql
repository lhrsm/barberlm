CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(token_val text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer_id uuid;
    v_total_price numeric;
    v_items jsonb;
    v_payment_method text;
    v_payment_status text;
    v_appointment_id uuid;
    v_refund_amount numeric;
BEGIN
    -- Get appointment details
    SELECT id, customer_id, total_price, items, payment_method, payment_status
    INTO v_appointment_id, v_customer_id, v_total_price, v_items, v_payment_method, v_payment_status
    FROM public.appointments
    WHERE cancel_token = token_val AND status = 'scheduled'
    LIMIT 1;

    IF v_appointment_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update appointment status
    UPDATE public.appointments
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_appointment_id;

    -- Handle credits if paid via PIX
    IF v_payment_method = 'pix' AND v_payment_status = 'paid' THEN
        -- Calculate refund amount from items if possible
        v_refund_amount := 0;
        IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
            SELECT SUM((item->>'price')::numeric * COALESCE((item->>'quantity')::numeric, 1))
            INTO v_refund_amount
            FROM jsonb_array_elements(v_items) AS item;
        END IF;
        
        IF v_refund_amount IS NULL OR v_refund_amount = 0 THEN
            v_refund_amount := v_total_price;
        END IF;

        UPDATE public.customers
        SET credits = COALESCE(credits, 0) + v_refund_amount
        WHERE id = v_customer_id;
    END IF;

    RETURN TRUE;
END;
$function$;