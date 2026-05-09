-- Update policies to allow super_admin access

-- Profiles
CREATE POLICY "Super admins can manage all profiles" ON public.profiles
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Barbers
CREATE POLICY "Super admins can manage all barbers" ON public.barbers
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Services
CREATE POLICY "Super admins can manage all services" ON public.services
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Customers
CREATE POLICY "Super admins can manage all customers" ON public.customers
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Appointments
CREATE POLICY "Super admins can manage all appointments" ON public.appointments
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Transactions
CREATE POLICY "Super admins can manage all transactions" ON public.transactions
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Products
CREATE POLICY "Super admins can manage all products" ON public.products
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Product Sales
CREATE POLICY "Super admins can manage all product sales" ON public.product_sales
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Notifications
CREATE POLICY "Super admins can manage all notifications" ON public.notifications
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Ensure super_admin exists or is assigned easily
-- (Usually handled by setting the role in the database for a specific user)
