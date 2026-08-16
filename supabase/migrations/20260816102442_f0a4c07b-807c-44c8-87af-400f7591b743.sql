ALTER TABLE public.appointments ALTER COLUMN tenant_id SET NOT NULL;

-- Atualizar política de RLS para permitir acesso via reception_permissions
DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;
CREATE POLICY "Tenant can view own appointments" ON public.appointments
FOR SELECT TO authenticated
USING (
  tenant_id = auth.uid() 
  OR 
  tenant_id IN (
    SELECT tenant_id 
    FROM public.reception_permissions 
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  is_super_admin_user()
);

-- Garantir acesso para INSERT e UPDATE também via reception_permissions
DROP POLICY IF EXISTS "Barbers can update their own appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments" ON public.appointments
FOR UPDATE TO authenticated
USING (
  tenant_id = auth.uid()
  OR
  barber_id IN (SELECT id FROM barbers WHERE user_id = auth.uid())
  OR
  tenant_id IN (
    SELECT tenant_id 
    FROM public.reception_permissions 
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  is_super_admin_user()
)
WITH CHECK (
  tenant_id = auth.uid()
  OR
  barber_id IN (SELECT id FROM barbers WHERE user_id = auth.uid())
  OR
  tenant_id IN (
    SELECT tenant_id 
    FROM public.reception_permissions 
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  is_super_admin_user()
);
