-- Allow anonymous SELECT on appointments
CREATE POLICY "Allow anonymous SELECT on appointments"
ON public.appointments
FOR SELECT
TO anon
USING (true);

-- Allow anonymous UPDATE on appointments (for status changes)
CREATE POLICY "Allow anonymous UPDATE on appointments"
ON public.appointments
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anonymous SELECT on notifications
CREATE POLICY "Allow anonymous SELECT on notifications"
ON public.notifications
FOR SELECT
TO anon
USING (true);

-- Allow anonymous UPDATE on notifications (for mark as read)
CREATE POLICY "Allow anonymous UPDATE on notifications"
ON public.notifications
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anonymous SELECT on transactions
CREATE POLICY "Allow anonymous SELECT on transactions"
ON public.transactions
FOR SELECT
TO anon
USING (true);

-- Allow anonymous SELECT on customers (needed for joined data)
CREATE POLICY "Allow anonymous SELECT on customers"
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Ensure services are viewable by everyone if not already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'services' AND policyname = 'Allow anonymous SELECT on services'
    ) THEN
        CREATE POLICY "Allow anonymous SELECT on services"
        ON public.services
        FOR SELECT
        TO anon
        USING (true);
    END IF;
END $$;
