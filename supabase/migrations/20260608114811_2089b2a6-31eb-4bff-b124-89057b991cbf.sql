-- Ensure paid_at column exists
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Create a function to log payment status changes for audit
CREATE OR REPLACE FUNCTION public.log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
        INSERT INTO public.financial_adjustment_logs (
            appointment_id,
            tenant_id,
            reason,
            old_values,
            new_values,
            adjusted_at,
            adjusted_by
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            'Payment status updated to ' || NEW.payment_status,
            jsonb_build_object('payment_status', OLD.payment_status, 'paid_at', OLD.paid_at),
            jsonb_build_object('payment_status', NEW.payment_status, 'paid_at', NEW.paid_at),
            now(),
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment status logging
DROP TRIGGER IF EXISTS on_payment_status_change ON public.appointments;
CREATE TRIGGER on_payment_status_change
    AFTER UPDATE OF payment_status ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.log_payment_status_change();
