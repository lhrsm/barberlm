-- 1. Melhorar RLS em appointments para garantir que clientes vejam seus agendamentos via customer_id
-- O problema atual é que muitos agendamentos estão com user_id do tenant, bloqueando o acesso do cliente.

-- Primeiro, remover políticas conflitantes se existirem ou apenas adicionar a definitiva.
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;

CREATE POLICY "Users can view their own appointments" ON public.appointments
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())) OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
);

-- 2. Garantir que administradores do tenant vejam todos os agendamentos do seu tenant
-- Independente de quem criou (user_id).
DROP POLICY IF EXISTS "Tenant can view own appointments" ON public.appointments;

CREATE POLICY "Tenant can view own appointments" ON public.appointments
FOR SELECT TO authenticated
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tenant_admin', 'manager'))) OR
  (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())) OR
  is_super_admin_user()
);

-- 3. Correção de dados (Backfill)
-- Associar agendamentos órfãos ao user_id correto se o customer_id estiver presente
UPDATE public.appointments a
SET user_id = c.user_id
FROM public.customers c
WHERE a.customer_id = c.id
AND a.user_id != c.user_id
AND c.user_id IS NOT NULL;

-- 4. Notificar Auditoria
COMMENT ON TABLE public.appointments IS 'Auditoria Forense de Visibilidade (Phase 1) - RLS Hardened para customer_id e tenant visibility.';
