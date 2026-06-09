CREATE OR REPLACE FUNCTION public.register_pix_payment_transaction(p_appointment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_appointment RECORD;
    v_transaction_id UUID;
    v_description TEXT;
    v_pix_amount NUMERIC;
BEGIN
    -- Get appointment details
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Check if it's a Pix payment and it's paid
    IF v_appointment.payment_method != 'pix' OR v_appointment.payment_status NOT IN ('paid', 'confirmed', 'completed') THEN
        RETURN;
    END IF;

    -- Calculate the real Pix amount (excluding credits/cashback)
    -- If final_amount exists, it's usually the part paid via Pix/Card
    v_pix_amount := COALESCE(v_appointment.final_amount, v_appointment.total_price, 0);
    
    -- If there's an explicit pix_amount in the breakdown, use it
    IF (v_appointment.payment_breakdown->>'pix_amount') IS NOT NULL THEN
        v_pix_amount := (v_appointment.payment_breakdown->>'pix_amount')::NUMERIC;
    ELSIF v_appointment.pix_amount > 0 THEN
        v_pix_amount := v_appointment.pix_amount;
    END IF;

    -- Check if transaction already exists for this appointment and Pix
    SELECT id INTO v_transaction_id 
    FROM public.transactions 
    WHERE appointment_id = p_appointment_id 
    AND type = 'income' 
    AND (payment_method = 'pix' OR pix_amount > 0);

    IF v_transaction_id IS NOT NULL THEN
        -- Transaction already exists, but let's ensure the amount is correct if it was 0
        UPDATE public.transactions 
        SET amount = v_pix_amount, 
            pix_amount = v_pix_amount,
            payment_method = 'pix'
        WHERE id = v_transaction_id AND (amount = 0 OR pix_amount = 0);
        RETURN;
    END IF;

    -- Get service and customer names for description
    v_description := 'Pagamento Pix - Agendamento Online';
    
    -- Create the financial transaction
    INSERT INTO public.transactions (
        user_id,
        appointment_id,
        tenant_id,
        barber_id,
        type,
        category,
        amount,
        pix_amount,
        payment_method,
        description,
        date,
        manual_adjustment
    ) VALUES (
        v_appointment.user_id,
        v_appointment.id,
        v_appointment.tenant_id,
        v_appointment.barber_id,
        'income',
        'Serviço',
        v_pix_amount,
        v_pix_amount,
        'pix',
        v_description,
        CURRENT_DATE,
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_appointment_payment_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If payment_status changed to 'paid' and it's Pix
    IF (NEW.payment_status = 'paid' OR NEW.payment_status = 'confirmed') 
       AND (NEW.payment_method = 'pix' OR NEW.pix_amount > 0) THEN
        PERFORM public.register_pix_payment_transaction(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_on_appointment_pix_paid ON public.appointments;
CREATE TRIGGER trigger_on_appointment_pix_paid
AFTER INSERT OR UPDATE OF payment_status, payment_method, pix_amount ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_payment_update();

-- Initial run for existing paid Pix appointments that don't have transactions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT id FROM public.appointments 
        WHERE payment_method = 'pix' 
        AND payment_status IN ('paid', 'confirmed', 'completed')
        AND id NOT IN (SELECT appointment_id FROM public.transactions WHERE appointment_id IS NOT NULL AND (payment_method = 'pix' OR pix_amount > 0))
    ) LOOP
        PERFORM public.register_pix_payment_transaction(r.id);
    END LOOP;
END;
$$;
