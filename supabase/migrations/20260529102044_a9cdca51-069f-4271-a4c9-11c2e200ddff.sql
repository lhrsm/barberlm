-- Corrigindo políticas da tabela barbers
DROP POLICY IF EXISTS "Barbeiros podem gerenciar seu próprio perfil" ON public.barbers;
DROP POLICY IF EXISTS "Public select for barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can manage their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can view their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can view their own tenant data" ON public.barbers;

-- Política de visualização: Qualquer um pode ver barbeiros ativos (para agendamento)
CREATE POLICY "Public select for active barbers" 
ON public.barbers 
FOR SELECT 
USING (active = true);

-- Política de gerenciamento: Apenas o próprio barbeiro ou admin/superadmin
CREATE POLICY "Barbers can manage their own profile" 
ON public.barbers 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Permitir que super admins vejam e gerenciem tudo (se não houver uma política global)
-- (Já existe "Super admins can manage all barbers" baseada em is_super_admin_user())

-- Corrigindo políticas da tabela appointments para Barbeiros
DROP POLICY IF EXISTS "Barbeiros podem atualizar seus agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbeiros podem ver seus agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Barbers can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barbers can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Barbers can delete their own appointments" ON public.appointments;

CREATE POLICY "Barbers can view their own appointments" 
ON public.appointments 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbers 
    WHERE public.barbers.id = public.appointments.barber_id 
    AND public.barbers.user_id = auth.uid()
  )
);

CREATE POLICY "Barbers can update their own appointments" 
ON public.appointments 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbers 
    WHERE public.barbers.id = public.appointments.barber_id 
    AND public.barbers.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbers 
    WHERE public.barbers.id = public.appointments.barber_id 
    AND public.barbers.user_id = auth.uid()
  )
);

-- Garantir que as tabelas tenham RLS habilitado
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
