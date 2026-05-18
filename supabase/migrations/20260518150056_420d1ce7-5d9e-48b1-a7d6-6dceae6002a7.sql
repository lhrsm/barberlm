-- Fix Transactions RLS Policies
DROP POLICY IF EXISTS "Barbers can view their own transactions" ON public.transactions;
CREATE POLICY "Barbers can view their own transactions"
ON public.transactions
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = transactions.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'tenant_admin', 'super_admin')
  ))
  OR
  (auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions"
ON public.transactions
FOR ALL
USING (
  (EXISTS (
    SELECT 1 FROM barbers 
    WHERE barbers.id = transactions.barber_id 
    AND barbers.user_id = auth.uid()
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'tenant_admin', 'super_admin')
  ))
  OR
  (auth.uid() = user_id)
);
