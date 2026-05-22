-- Adicionar coluna user_id se não existir
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Atualizar políticas RLS para support_tickets
DROP POLICY IF EXISTS "Tenants can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Tenants see their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admin can update tickets" ON public.support_tickets;

CREATE POLICY "Users can create tickets" ON public.support_tickets 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can see their salon tickets" ON public.support_tickets 
FOR SELECT USING (
  tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid() OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Admins can update all tickets" ON public.support_tickets 
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- RLS para support_messages
DROP POLICY IF EXISTS "Anyone can create support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Anyone can view support messages" ON public.support_messages;

CREATE POLICY "Users can create messages in their tickets" ON public.support_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_id AND (tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid() OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  )
);

CREATE POLICY "Users can view messages in their tickets" ON public.support_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_id AND (tenant_id IN (SELECT id FROM public.profiles WHERE id = auth.uid() OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  )
);
