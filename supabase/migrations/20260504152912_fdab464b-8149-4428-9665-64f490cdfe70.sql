-- Create a table for the many-to-many relationship between barbers and services
CREATE TABLE IF NOT EXISTS public.barber_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(barber_id, service_id)
);

-- Enable RLS
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Policies for barber_services
CREATE POLICY "Users can view their own barber_services"
ON public.barber_services
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view barber_services via public profile"
ON public.barber_services
FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own barber_services"
ON public.barber_services
FOR ALL
USING (auth.uid() = user_id);
