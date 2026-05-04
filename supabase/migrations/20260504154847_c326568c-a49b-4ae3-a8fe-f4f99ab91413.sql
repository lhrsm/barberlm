-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'appointment', 'product'
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications"
ON public.notifications
FOR ALL
USING (auth.uid() = user_id);

-- Add cancel_token and metadata to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();

-- Create a function to allow public cancellation via token
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(token_val UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.appointments
    SET status = 'cancelled', updated_at = now()
    WHERE cancel_token = token_val AND status = 'scheduled';
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new appointments to create notifications
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
    business_name_val TEXT;
BEGIN
    -- Get business name
    SELECT business_name INTO business_name_val FROM public.profiles WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
        NEW.user_id,
        'Novo Agendamento',
        'Um novo agendamento foi realizado para ' || (SELECT name FROM public.customers WHERE id = NEW.customer_id),
        'appointment',
        '/calendar'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_appointment ON public.appointments;
CREATE TRIGGER tr_notify_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_appointment();
