-- Migration: hotfix02_customer_portal_rls
-- Descrição: Ajustes de RLS para o portal do cliente e sincronização de perfis

-- 1. Assegurar existência da coluna auth_user_id em customers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'auth_user_id') THEN
        ALTER TABLE public.customers ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Função claim_customer_profile para vincular perfil por telefone
CREATE OR REPLACE FUNCTION public.claim_customer_profile(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phone TEXT;
    v_customer_id UUID;
BEGIN
    -- Obter telefone do usuário autenticado (metadados do auth.users)
    SELECT (raw_user_meta_data->>'phone')::text INTO v_phone
    FROM auth.users
    WHERE id = target_user_id;

    IF v_phone IS NULL OR v_phone = '' THEN
        RETURN FALSE;
    END IF;

    -- Tentar encontrar um customer com este telefone que não tenha auth_user_id vinculado
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_phone
      AND auth_user_id IS NULL
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET auth_user_id = target_user_id
        WHERE id = v_customer_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. Novas Policies para o Portal do Cliente
-- Garantir que customers possam ver seus próprios dados
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile"
ON public.customers
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Garantir que appointments sejam visíveis para o dono
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
    customer_id IN (
        SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
    )
);

-- Garantir GRANTs
GRANT SELECT, UPDATE ON public.customers TO authenticated;
GRANT SELECT ON public.appointments TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_profile(UUID) TO authenticated;

