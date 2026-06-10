-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own credits" ON public.customer_credits;
DROP POLICY IF EXISTS "Users can manage their own credits" ON public.customer_credits;
DROP POLICY IF EXISTS "Service role can manage all credits" ON public.customer_credits;

-- 1. Permissão de SELECT para o tenant e para o cliente (caso queira ver seu saldo no portal)
CREATE POLICY "Allow SELECT for tenant and owner" ON public.customer_credits
FOR SELECT 
USING (
  auth.uid() = tenant_id OR 
  auth.uid() = customer_id
);

-- 2. Permissão de INSERT para o tenant
-- O agendamento é concluído pelo tenant/barbeiro, então eles precisam inserir novos créditos (cashback/fidelidade)
CREATE POLICY "Allow INSERT for tenant" ON public.customer_credits
FOR INSERT 
WITH CHECK (
  auth.uid() = tenant_id
);

-- 3. Permissão de UPDATE para o tenant
-- Necessário para marcar crédito como usado, expirado, etc.
CREATE POLICY "Allow UPDATE for tenant" ON public.customer_credits
FOR UPDATE
USING (
  auth.uid() = tenant_id
)
WITH CHECK (
  auth.uid() = tenant_id
);

-- 4. Garantir acesso total para service_role (Edge Functions)
GRANT ALL ON public.customer_credits TO service_role;
GRANT ALL ON public.customer_credits TO authenticated;

-- Garantir que RLS está habilitado
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
