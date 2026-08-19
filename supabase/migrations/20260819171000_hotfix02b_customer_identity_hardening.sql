-- ============================================================================
-- HOTFIX 02B: Hardening de Identidade do Cliente, RPC claim_customer_profile e RLS
-- Migration Corretiva / Delta sobre 20260819125000_hotfix02_customer_portal_rls
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BACKFILL SEGURO: Apenas clientes com email verificado em auth.users e par único
-- ----------------------------------------------------------------------------
WITH eligible_candidates AS (
  SELECT c.id
  FROM public.customers c
  JOIN auth.users au ON au.id = c.user_id
  WHERE c.auth_migration_status = 'completed'
    AND c.auth_user_id IS NULL
    AND c.user_id IS NOT NULL
    AND c.user_id != c.tenant_id
    AND au.email_confirmed_at IS NOT NULL
    AND c.email IS NOT NULL
    AND pg_catalog.lower(pg_catalog.trim(c.email)) = pg_catalog.lower(pg_catalog.trim(au.email))
    AND (c.tenant_id, c.user_id) IN (
      SELECT sub.tenant_id, sub.user_id
      FROM public.customers sub
      WHERE sub.auth_migration_status = 'completed'
        AND sub.user_id IS NOT NULL
        AND sub.user_id != sub.tenant_id
      GROUP BY sub.tenant_id, sub.user_id
      HAVING pg_catalog.count(*) = 1
    )
)
UPDATE public.customers
SET auth_user_id = user_id
WHERE id IN (SELECT id FROM eligible_candidates);

-- ----------------------------------------------------------------------------
-- 2. ÍNDICES: Índice único parcial e índices compostos de performance
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_auth_user 
ON public.customers (tenant_id, auth_user_id) 
WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_tenant 
ON public.appointments (customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_tenant 
ON public.credit_transactions (customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_cashback_transactions_customer_tenant 
ON public.cashback_transactions (customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_customer_achievements_cust 
ON public.customer_achievements (customer_id);

-- ----------------------------------------------------------------------------
-- 3. RPC: claim_customer_profile (Substituição com retorno JSONB, search_path='' e validação em auth.users)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_customer_profile(UUID);

CREATE OR REPLACE FUNCTION public.claim_customer_profile(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid UUID;
  v_auth_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_existing_customer_id UUID;
  v_total_matching INT;
  v_target_customer_id UUID;
  v_target_auth_user_id UUID;
BEGIN
  -- 1. Validar autenticação do chamador
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'UNAUTHENTICATED',
      'message', 'Usuário não autenticado.'
    );
  END IF;

  IF p_tenant_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'INVALID_TENANT',
      'message', 'Tenant ID inválido.'
    );
  END IF;

  -- 2. Obter e comprovar email confirmado diretamente de auth.users
  SELECT au.email, au.email_confirmed_at
  INTO v_auth_email, v_email_confirmed_at
  FROM auth.users au
  WHERE au.id = v_auth_uid;

  IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'EMAIL_NOT_VERIFIED',
      'message', 'E-mail do usuário não está confirmado no sistema de autenticação.'
    );
  END IF;

  v_auth_email := pg_catalog.lower(pg_catalog.trim(v_auth_email));

  -- 3. Verificar se este auth user já possui vínculo prévio neste tenant
  SELECT id INTO v_existing_customer_id
  FROM public.customers
  WHERE tenant_id = p_tenant_id
    AND auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_existing_customer_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'ALREADY_CLAIMED',
      'customer_id', v_existing_customer_id
    );
  END IF;

  -- 4. Contar todos os clientes com este email no tenant
  SELECT 
    pg_catalog.count(*),
    (pg_catalog.array_agg(c.id))[1],
    (pg_catalog.array_agg(c.auth_user_id))[1]
  INTO 
    v_total_matching,
    v_target_customer_id,
    v_target_auth_user_id
  FROM public.customers c
  WHERE c.tenant_id = p_tenant_id
    AND pg_catalog.lower(pg_catalog.trim(pg_catalog.coalesce(c.email, ''))) = v_auth_email;

  -- Cenário D: 0 registros
  IF v_total_matching = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'CUSTOMER_NOT_FOUND',
      'message', 'Nenhum cadastro de cliente correspondente encontrado neste estabelecimento.'
    );
  END IF;

  -- Cenário E / F: Mais de 1 registro com o mesmo email no tenant (Bloqueio Conservador)
  IF v_total_matching > 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'AMBIGUOUS_CUSTOMER',
      'message', 'Múltiplos cadastros encontrados com o mesmo e-mail. Requer atendimento da barbearia.'
    );
  END IF;

  -- Cenário B: Exatamente 1 registro e já vinculado a este mesmo usuário
  IF v_target_auth_user_id = v_auth_uid THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'ALREADY_CLAIMED',
      'customer_id', v_target_customer_id
    );
  END IF;

  -- Cenário C: Exatamente 1 registro e já vinculado a OUTRO usuário
  IF v_target_auth_user_id IS NOT NULL AND v_target_auth_user_id != v_auth_uid THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'CUSTOMER_ALREADY_LINKED',
      'message', 'Este cadastro de cliente já está vinculado a outra conta de autenticação.'
    );
  END IF;

  -- Cenário A: Exatamente 1 registro e auth_user_id IS NULL -> Realizar Claim Atômico
  UPDATE public.customers
  SET auth_user_id = v_auth_uid,
      auth_migration_status = 'completed',
      updated_at = pg_catalog.now()
  WHERE id = v_target_customer_id
    AND tenant_id = p_tenant_id
    AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'CLAIM_CONFLICT',
      'message', 'Conflito de concorrência ao vincular o perfil. Tente novamente.'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'SUCCESS',
    'customer_id', v_target_customer_id
  );
END;
$$;

-- Permissões estritas da RPC
REVOKE ALL ON FUNCTION public.claim_customer_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_customer_profile(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_customer_profile(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. POLICIES DE RLS HARDENED
-- ----------------------------------------------------------------------------

-- A. customers: leitura do próprio perfil pelo cliente autenticado
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile"
ON public.customers
FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
);

-- B. appointments: leitura de agendamentos do próprio cliente no tenant
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = appointments.customer_id
      AND c.tenant_id = appointments.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);

-- C. credit_transactions: leitura de créditos do próprio cliente no tenant
DROP POLICY IF EXISTS "Customers can view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Customers can view own credit transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = credit_transactions.customer_id
      AND c.tenant_id = credit_transactions.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);

-- D. cashback_transactions: leitura de cashback do próprio cliente no tenant
DROP POLICY IF EXISTS "Customers can view own cashback transactions" ON public.cashback_transactions;
CREATE POLICY "Customers can view own cashback transactions"
ON public.cashback_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = cashback_transactions.customer_id
      AND c.tenant_id = cashback_transactions.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);

-- E. customer_subscriptions: leitura de assinaturas do próprio cliente no tenant
DROP POLICY IF EXISTS "Customers can view own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can view own subscriptions"
ON public.customer_subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = customer_subscriptions.customer_id
      AND c.tenant_id = customer_subscriptions.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);

-- F. customer_achievements: remover policy permissiva antiga e restringir por customer
DROP POLICY IF EXISTS "Customers can read their own achievements" ON public.customer_achievements;
DROP POLICY IF EXISTS "Customers can view own achievements" ON public.customer_achievements;
CREATE POLICY "Customers can view own achievements"
ON public.customer_achievements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = customer_achievements.customer_id
      AND c.auth_user_id = auth.uid()
  )
);
