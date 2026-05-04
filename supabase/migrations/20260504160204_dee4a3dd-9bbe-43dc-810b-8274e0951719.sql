-- Add free_service_threshold to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_service_threshold INTEGER DEFAULT 10;

-- Add loyalty_points to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;

-- Function to increment loyalty points on appointment completion
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'completed'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + 1
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for appointment completion
DROP TRIGGER IF EXISTS on_appointment_completed ON public.appointments;
CREATE TRIGGER on_appointment_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_completion();
