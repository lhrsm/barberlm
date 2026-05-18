-- Allow barbers to login with phone number (handled via existing auth, but we ensure profiles are accessible)
-- The user_roles table defines who is a 'barber'.

-- Update RLS policies for appointments to allow barbers to manage their own appointments
CREATE POLICY "Barbers can view their own appointments" 
ON public.appointments 
FOR SELECT 
USING (
  auth.uid() = barber_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin', 'super_admin')
  )
);

CREATE POLICY "Barbers can update their own appointments" 
ON public.appointments 
FOR UPDATE 
USING (
  auth.uid() = barber_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin', 'super_admin')
  )
);

CREATE POLICY "Barbers can delete their own appointments" 
ON public.appointments 
FOR DELETE 
USING (
  auth.uid() = barber_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin', 'super_admin')
  )
);

-- Update RLS policies for transactions to allow barbers to view their own history
CREATE POLICY "Barbers can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (
  auth.uid() = barber_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin', 'super_admin')
  )
);
