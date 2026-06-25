CREATE OR REPLACE FUNCTION public.trg_commission_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      PERFORM public.create_barber_commission_for_appointment(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_barber_commission_for_appointment(NEW.id);
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.barber_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE appointment_id = NEW.id
      AND barber_id = NEW.barber_id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;