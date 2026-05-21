-- Create policy for super admins to manage all subscriptions
CREATE POLICY "Super admins can manage all subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);