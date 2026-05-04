-- Allow anyone to view profiles by slug
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Allow anyone to view services
CREATE POLICY "Services are viewable by everyone" 
ON public.services 
FOR SELECT 
USING (true);

-- Allow anyone to view barbers
CREATE POLICY "Barbers are viewable by everyone" 
ON public.barbers 
FOR SELECT 
USING (true);

-- Allow anyone to insert appointments (for public booking)
CREATE POLICY "Anyone can create appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (true);
