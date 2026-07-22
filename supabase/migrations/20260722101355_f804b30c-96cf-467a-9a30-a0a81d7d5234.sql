
-- 1) plans.max_addons
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_addons INTEGER NOT NULL DEFAULT 3;
UPDATE public.plans SET max_addons = 3 WHERE slug = 'starter';
UPDATE public.plans SET max_addons = 5 WHERE slug = 'pro';
UPDATE public.plans SET max_addons = 99 WHERE slug = 'elite';

-- 2) saas_addons — catálogo
CREATE TABLE IF NOT EXISTS public.saas_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'gestao',
  icon TEXT,
  module_key TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  stripe_price_id_test TEXT,
  stripe_price_id_live TEXT,
  minimum_plan TEXT,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  trial_days INTEGER NOT NULL DEFAULT 0,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.saas_addons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.saas_addons TO authenticated;
GRANT ALL ON public.saas_addons TO service_role;

ALTER TABLE public.saas_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catálogo de add-ons ativos é público"
  ON public.saas_addons FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin gerencia add-ons"
  ON public.saas_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 3) tenant_addons — contratos
CREATE TABLE IF NOT EXISTS public.tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  addon_id UUID NOT NULL REFERENCES public.saas_addons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_addons_status_check
    CHECK (status IN ('pending','trialing','active','past_due','cancelled','expired'))
);

-- Único por (tenant, addon) quando quantidade=1; para add-ons com max_quantity>1
-- (ex.: pacote de automações) permitimos múltiplas linhas — o índice único é parcial.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_addons_unique_single
  ON public.tenant_addons (tenant_id, addon_id)
  WHERE quantity = 1;
CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant ON public.tenant_addons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_status ON public.tenant_addons(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_addons TO authenticated;
GRANT ALL ON public.tenant_addons TO service_role;

ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Barbearia vê seus próprios add-ons"
  ON public.tenant_addons FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin gerencia contratos"
  ON public.tenant_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4) helper: tenant_has_active_addon
CREATE OR REPLACE FUNCTION public.tenant_has_active_addon(_tenant_id UUID, _module_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_addons ta
    JOIN public.saas_addons a ON a.id = ta.addon_id
    WHERE ta.tenant_id = _tenant_id
      AND a.module_key = _module_key
      AND ta.status IN ('active','trialing','past_due')
      AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_active_addon(UUID, TEXT) TO authenticated, anon, service_role;

-- 5) trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_saas_addons_updated ON public.saas_addons;
CREATE TRIGGER trg_saas_addons_updated BEFORE UPDATE ON public.saas_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_addons_updated ON public.tenant_addons;
CREATE TRIGGER trg_tenant_addons_updated BEFORE UPDATE ON public.tenant_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Seed dos 17 add-ons
INSERT INTO public.saas_addons
  (addon_key, name, description, category, icon, module_key, monthly_price, minimum_plan, max_quantity, benefits, sort_order)
VALUES
  ('store', 'Loja Virtual', 'Venda produtos e serviços online com sua vitrine pública personalizada.', 'vendas', 'ShoppingBag', 'store', 19.90, 'starter', 1,
   '["Vitrine pública com seu slug", "Pagamento PIX integrado", "Gestão de pedidos"]'::jsonb, 10),
  ('stock', 'Controle de Estoque', 'Gerencie entrada, saída e alertas de estoque de produtos.', 'gestao', 'Package', 'stock', 14.90, 'starter', 1,
   '["Alertas de estoque baixo", "Movimentações automáticas", "Relatório de giro"]'::jsonb, 20),
  ('subscriptions', 'Assinaturas para Clientes', 'Crie planos de fidelidade recorrente pagos pelos seus clientes.', 'financeiro', 'CreditCard', 'subscriptions', 29.90, 'starter', 1,
   '["Planos ilimitados", "Cobrança recorrente", "Cartão digital de assinante"]'::jsonb, 30),
  ('cashback', 'Cashback', 'Ofereça cashback em atendimentos e produtos para fidelizar clientes.', 'relacionamento', 'Wallet', 'cashback', 12.90, 'starter', 1,
   '["Regras por serviço", "Saldo por cliente", "Uso em novas compras"]'::jsonb, 40),
  ('loyalty', 'Fidelidade Premium', 'Programa de pontos, recompensas e campanhas de fidelização.', 'relacionamento', 'Trophy', 'loyalty', 19.90, 'starter', 1,
   '["Pontos por gasto", "Recompensas customizadas", "Templates prontos"]'::jsonb, 50),
  ('coupons', 'Cupons e Campanhas', 'Crie cupons de desconto e campanhas segmentadas.', 'relacionamento', 'Ticket', 'coupons', 14.90, 'starter', 1,
   '["Cupons ilimitados", "Regras avançadas", "Relatório de uso"]'::jsonb, 60),
  ('advanced_finance', 'Financeiro Avançado', 'DRE, fluxo de caixa projetado, categorias e comparativos.', 'financeiro', 'TrendingUp', 'advanced_finance', 24.90, 'starter', 1,
   '["Fluxo projetado", "Comparativo mensal", "Exportação PDF"]'::jsonb, 70),
  ('reports_advanced', 'Relatórios Avançados', 'Dashboards executivos, análise de barbeiros e comportamento de clientes.', 'gestao', 'BarChart3', 'reports_advanced', 19.90, 'starter', 1,
   '["Dashboards executivos", "Ranking de barbeiros", "Análise de retenção"]'::jsonb, 80),
  ('commissions', 'Comissões', 'Cálculo automático de comissões por barbeiro e serviço.', 'financeiro', 'Percent', 'commissions', 14.90, 'starter', 1,
   '["Regras por serviço", "Fechamento mensal", "Recibos automáticos"]'::jsonb, 90),
  ('payment_gateway', 'Gateway de Pagamentos', 'Receba pagamentos online (PIX, cartão) direto no atendimento.', 'financeiro', 'CreditCard', 'payment_gateway', 19.90, 'starter', 1,
   '["Mercado Pago, Asaas, InfinitePay", "PIX instantâneo", "Split opcional"]'::jsonb, 100),
  ('automations_extra_single', 'Automação extra (avulsa)', 'Adicione 1 automação adicional além do limite do seu plano.', 'automacao', 'Zap', 'automations_extra', 4.90, 'starter', 20,
   '["+1 automação por unidade", "Sem compromisso", "Cobrança avulsa"]'::jsonb, 110),
  ('automations_pack_5', 'Pacote 5 Automações Extras', '+5 automações além do limite do seu plano.', 'automacao', 'Zap', 'automations_extra', 19.90, 'starter', 5,
   '["+5 automações", "Economia vs avulso", "Renovação mensal"]'::jsonb, 120),
  ('automations_unlimited', 'Automações Ilimitadas', 'Remove qualquer limite de automações da sua conta.', 'automacao', 'Infinity', 'automations_unlimited', 39.90, 'pro', 1,
   '["Sem limite de fluxos", "Todos os gatilhos", "Uso ilimitado"]'::jsonb, 130),
  ('ai_assistant', 'IA para Atendimento', 'Assistente de IA para respostas automáticas e recomendações.', 'ia', 'Sparkles', 'ai', 49.90, 'pro', 1,
   '["Respostas inteligentes", "Sugestões de horário", "Custo de API à parte"]'::jsonb, 140),
  ('api_access', 'API Pública', 'Acesso à API REST do Barbex para integrações próprias.', 'integracoes', 'Code', 'api_access', 39.90, 'pro', 1,
   '["Endpoints REST", "Chave por barbearia", "Documentação completa"]'::jsonb, 150),
  ('integrations', 'Integrações', 'Conecte Google Calendar, Zapier, Make e outros serviços.', 'integracoes', 'Plug', 'integrations', 29.90, 'pro', 1,
   '["Google Calendar", "Zapier / Make", "Webhooks customizados"]'::jsonb, 160),
  ('white_label', 'White Label', 'Personalize marca, cores e domínio da sua conta.', 'gestao', 'Palette', 'white_label', 59.90, 'pro', 1,
   '["Domínio próprio", "Cores personalizadas", "Logo em e-mails"]'::jsonb, 170)
ON CONFLICT (addon_key) DO NOTHING;
