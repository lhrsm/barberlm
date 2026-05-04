-- Create service_ratings table
CREATE TABLE IF NOT EXISTS public.service_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(appointment_id) -- One rating per appointment
);

-- Enable RLS
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Ratings are viewable by everyone" 
ON public.service_ratings FOR SELECT USING (true);

CREATE POLICY "Customers can insert ratings" 
ON public.service_ratings FOR INSERT WITH CHECK (true);

-- Add average rating columns to related tables
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- Function to update average ratings
CREATE OR REPLACE FUNCTION public.update_barber_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.barbers
    SET 
        average_rating = (
            SELECT AVG(rating)::DECIMAL(3,2) 
            FROM public.service_ratings 
            WHERE barber_id = NEW.barber_id
        ),
        total_ratings = (
            SELECT COUNT(*) 
            FROM public.service_ratings 
            WHERE barber_id = NEW.barber_id
        )
    WHERE id = NEW.barber_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE TRIGGER on_rating_submitted
AFTER INSERT OR UPDATE ON public.service_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_barber_rating();
