CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(token_val text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_customer_id uuid;
    v_total_price numeric;
    v_payment_method text;
    v_payment_status text;
    v_appointment_id uuid;
BEGIN
    -- Get appointment details
    SELECT id, customer_id, total_price, payment_method, payment_status
    INTO v_appointment_id, v_customer_id, v_total_price, v_payment_method, v_payment_status
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
        UPDATE public.customers
        SET credits = COALESCE(credits, 0) + v_total_price
        WHERE id = v_customer_id;
    END IF;

    RETURN TRUE;
END;
$function$;