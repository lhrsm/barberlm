
-- 1. Reforçar a RLS de customers para garantir que o usuário veja seu próprio registro
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
CREATE POLICY "Users can view their own customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ))
);

-- 2. Reforçar a RLS de appointments para visibilidade via customer_id
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ))
);

-- 3. Garantir que administradores vejam todos os clientes do seu tenant
DROP POLICY IF EXISTS "Tenant members can view customers" ON public.customers;
CREATE POLICY "Tenant members can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
  )) OR
  (tenant_id IN (
    SELECT id FROM barbershops WHERE owner_id = auth.uid()
  )) OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 4. Garantir que o admin de teste (louisdabahia) tenha a role correta e o tenant_id configurado no profile
UPDATE public.profiles 
SET role = 'admin', tenant_id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08'
WHERE id = 'c54ac1ac-49be-4505-b7a4-d257ed023f08';
