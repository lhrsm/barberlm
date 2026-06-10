-- Garantir que o RLS está ativado
ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos (se houver)
DROP POLICY IF EXISTS "Users can view their tenant's cashback transactions" ON public.cashback_transactions;
DROP POLICY IF EXISTS "Users can insert cashback transactions for their tenant" ON public.cashback_transactions;
DROP POLICY IF EXISTS "Service role can do everything on cashback_transactions" ON public.cashback_transactions;

-- Política de SELECT
CREATE POLICY "Users can view their tenant's cashback transactions" 
ON public.cashback_transactions FOR SELECT 
TO authenticated 
USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Política de INSERT
CREATE POLICY "Users can insert cashback transactions for their tenant" 
ON public.cashback_transactions FOR INSERT 
TO authenticated 
WITH CHECK (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Política para service_role (Edge Functions / Internal tasks)
CREATE POLICY "Service role can do everything on cashback_transactions" 
ON public.cashback_transactions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Garantir GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_transactions TO authenticated;
GRANT ALL ON public.cashback_transactions TO service_role;

-- Atualizar a função complete_appointment para SECURITY DEFINER
-- Isso permite que a função ignore o RLS do usuário que a chamou e use as permissões do dono da função (normalmente postgres/service_role)
-- No entanto, por segurança, a função já valida o acesso internamente.
ALTER FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, text, uuid, text, jsonb) TO service_role;
