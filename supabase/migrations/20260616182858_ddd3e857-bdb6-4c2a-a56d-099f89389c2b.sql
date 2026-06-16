-- Auto refund subscription benefit when premium appointment is canceled
CREATE OR REPLACE FUNCTION public.tr_refund_subscription_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  -- Only act on transition INTO canceled
  IF NEW.status = 'canceled'
     AND (OLD.status IS NULL OR OLD.status <> 'canceled')
     AND NEW.subscription_id IS NOT NULL THEN

    -- Find any usage log tied to this appointment
    SELECT id INTO v_log_id
    FROM public.subscription_usage_logs
    WHERE appointment_id = NEW.id
    LIMIT 1;

    IF v_log_id IS NOT NULL THEN
      DELETE FROM public.subscription_usage_logs WHERE id = v_log_id;

      -- Decrement uses_this_period (clamp at 0)
      UPDATE public.customer_subscriptions
      SET uses_this_period = GREATEST(0, uses_this_period - 1),
          updated_at = now()
      WHERE id = NEW.subscription_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_refund_subscription_on_cancel ON public.appointments;
CREATE TRIGGER tr_refund_subscription_on_cancel
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.tr_refund_subscription_on_cancel();