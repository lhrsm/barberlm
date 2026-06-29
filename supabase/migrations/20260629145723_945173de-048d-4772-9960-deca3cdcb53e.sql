
-- ============================================================
-- LOYALTY PREMIUM TEMPLATES SYSTEM
-- ============================================================

-- 1) Template catalog (global)
CREATE TABLE public.loyalty_campaign_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  icon TEXT,
  color TEXT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_campaign_templates TO anon, authenticated;
GRANT ALL ON public.loyalty_campaign_templates TO service_role;
ALTER TABLE public.loyalty_campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates readable by all"
  ON public.loyalty_campaign_templates FOR SELECT
  USING (true);

-- 2) Per-tenant campaigns
CREATE TABLE public.loyalty_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  template_slug TEXT REFERENCES public.loyalty_campaign_templates(slug) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  image_url TEXT,
  icon TEXT,
  color TEXT,
  badge TEXT,
  allow_stacking BOOLEAN NOT NULL DEFAULT false,
  allow_combine BOOLEAN NOT NULL DEFAULT false,
  limit_per_customer INT,
  limit_per_campaign INT,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  notify_push BOOLEAN NOT NULL DEFAULT false,
  notify_portal BOOLEAN NOT NULL DEFAULT true,
  message_template TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_campaigns_tenant ON public.loyalty_campaigns(tenant_id);
CREATE INDEX idx_loyalty_campaigns_status ON public.loyalty_campaigns(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_campaigns TO authenticated;
GRANT ALL ON public.loyalty_campaigns TO service_role;
ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners manage campaigns"
  ON public.loyalty_campaigns FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 3) Participations
CREATE TABLE public.loyalty_campaign_participations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.loyalty_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC,
  unlocked_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  reward_granted JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, customer_id)
);

CREATE INDEX idx_loyalty_part_tenant ON public.loyalty_campaign_participations(tenant_id);
CREATE INDEX idx_loyalty_part_campaign ON public.loyalty_campaign_participations(campaign_id);
CREATE INDEX idx_loyalty_part_customer ON public.loyalty_campaign_participations(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_campaign_participations TO authenticated;
GRANT ALL ON public.loyalty_campaign_participations TO service_role;
ALTER TABLE public.loyalty_campaign_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners view participations"
  ON public.loyalty_campaign_participations FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_loyalty_premium_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_loy_camp_tpl_upd BEFORE UPDATE ON public.loyalty_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();
CREATE TRIGGER trg_loy_camp_upd BEFORE UPDATE ON public.loyalty_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();
CREATE TRIGGER trg_loy_part_upd BEFORE UPDATE ON public.loyalty_campaign_participations
  FOR EACH ROW EXECUTE FUNCTION public.tg_loyalty_premium_updated_at();

-- 5) Seed 20 templates
INSERT INTO public.loyalty_campaign_templates
  (slug, name, description, category, difficulty, icon, color, benefits, default_config, is_featured, sort_order)
VALUES
('clube-dos-10','Clube dos 10','A cada 10 atendimentos concluídos o cliente ganha um corte gratuito.','recorrencia','easy','Scissors','#f59e0b',
 '["1 serviço gratuito a cada 10","Engajamento contínuo","Aumenta retenção"]',
 '{"rule_type":"visits","target":10,"reward":{"type":"free_service","quantity":1}}', true, 1),

('cashback-progressivo','Cashback Progressivo','Quanto mais o cliente consome, maior o cashback.','cashback','medium','TrendingUp','#10b981',
 '["Cashback escalonado","Incentivo ao ticket alto","Recompensa proporcional"]',
 '{"rule_type":"cashback_tiers","tiers":[{"up_to":100,"percent":5},{"up_to":300,"percent":8},{"up_to":null,"percent":10}],"validity_days":90}', true, 2),

('cliente-ouro','Cliente Ouro','Clientes que atingirem o faturamento alvo se tornam Ouro com benefícios permanentes.','crescimento','medium','Crown','#eab308',
 '["10% desconto permanente","Prioridade no agendamento","Brinde anual"]',
 '{"rule_type":"spend","target":800,"reward":{"type":"permanent_discount","percent":10,"perks":["priority_booking","annual_gift"]}}', true, 3),

('aniversariante-premium','Aniversariante Premium','Benefício especial no mês do aniversário do cliente.','datas','easy','Cake','#ec4899',
 '["20% de desconto","Barba gratuita","Produto cortesia"]',
 '{"rule_type":"birthday","reward_options":[{"type":"discount","percent":20},{"type":"free_service","service":"barba"},{"type":"free_product"}]}', true, 4),

('indique-um-amigo','Indique um Amigo','Cliente ganha recompensa ao indicar um novo cliente que concluir atendimento.','crescimento','medium','UserPlus','#3b82f6',
 '["R$30 em créditos por indicação","Crescimento orgânico","Premia ambos os lados"]',
 '{"rule_type":"referral","trigger":"first_completed_appointment","reward":{"type":"credit","amount":30}}', true, 5),

('cliente-vip','Cliente VIP','Após várias visitas, cliente vira VIP com benefícios contínuos.','crescimento','medium','Star','#a855f7',
 '["Agenda prioritária","Descontos exclusivos","Brindes mensais"]',
 '{"rule_type":"visits","target":30,"reward":{"type":"vip_status","perks":["priority","discounts","gifts"]}}', false, 6),

('desafio-mensal','Desafio Mensal','Conclua atendimentos no mês para ganhar créditos.','recorrencia','easy','Target','#f97316',
 '["Recompensa rápida","Mecânica de meta","Aumenta frequência"]',
 '{"rule_type":"challenge","period":"month","target":4,"reward":{"type":"credit","amount":40}}', false, 7),

('clube-da-barba','Clube da Barba','A cada 6 barbas, ganhe 1 barba.','recorrencia','easy','Award','#92400e',
 '["1 barba grátis a cada 6","Foco em fidelizar barba","Simples e direto"]',
 '{"rule_type":"visits","service_filter":"barba","target":6,"reward":{"type":"free_service","service":"barba","quantity":1}}', false, 8),

('clube-do-cabelo','Clube do Cabelo','A cada 8 cortes, ganhe 1 corte.','recorrencia','easy','Scissors','#0ea5e9',
 '["1 corte grátis a cada 8","Foco em cortes","Recorrência elevada"]',
 '{"rule_type":"visits","service_filter":"corte","target":8,"reward":{"type":"free_service","service":"corte","quantity":1}}', false, 9),

('combo-premiado','Combo Premiado','A cada 10 combos, ganhe 1 combo.','recorrencia','medium','Gift','#8b5cf6',
 '["1 combo grátis a cada 10","Incentivo ao combo","Ticket alto"]',
 '{"rule_type":"visits","service_filter":"combo","target":10,"reward":{"type":"free_service","service":"combo","quantity":1}}', false, 10),

('cliente-frequente','Cliente Frequente','Manteve atendimentos por 3 meses consecutivos.','recorrencia','medium','Calendar','#06b6d4',
 '["Produto, crédito ou cashback","Premia consistência","Reduz churn"]',
 '{"rule_type":"consecutive_months","target":3,"reward_options":[{"type":"product"},{"type":"credit","amount":50},{"type":"cashback","percent":10}]}', false, 11),

('cliente-sem-falta','Cliente Sem Falta','Não faltou em nenhum agendamento por 90 dias.','recorrencia','medium','CheckCircle','#22c55e',
 '["Brinde","Desconto","Serviço bônus"]',
 '{"rule_type":"no_show_streak","period_days":90,"reward_options":[{"type":"gift"},{"type":"discount","percent":15},{"type":"free_service"}]}', false, 12),

('assinante-premium','Assinante Premium','Recompensas para assinantes ativos por 3, 6 e 12 meses.','assinaturas','advanced','Crown','#facc15',
 '["Marcos progressivos","Brinde a cada milestone","Reduz cancelamento"]',
 '{"rule_type":"subscription_tenure","milestones":[{"months":3,"reward":{"type":"product"}},{"months":6,"reward":{"type":"cashback","percent":10}},{"months":12,"reward":{"type":"upgrade"}}]}', true, 13),

('compra-de-produtos','Compra de Produtos','A cada R$300 em produtos, ganhe R$30 em créditos.','cashback','easy','ShoppingBag','#14b8a6',
 '["Incentiva venda de produtos","Crédito reutilizável","Aumenta ticket"]',
 '{"rule_type":"product_spend","target":300,"reward":{"type":"credit","amount":30}}', false, 14),

('black-friday','Black Friday','Campanha temporária de Black Friday com recompensas turbinadas.','datas','medium','Zap','#dc2626',
 '["Cashback dobrado","Descontos especiais","Tempo limitado"]',
 '{"rule_type":"campaign_window","reward":{"type":"cashback","percent":15},"duration_days":7}', true, 15),

('natal','Natal','Campanha de Natal pronta com benefícios festivos.','datas','easy','Gift','#16a34a',
 '["Brinde de Natal","Desconto especial","Engajamento sazonal"]',
 '{"rule_type":"campaign_window","reward":{"type":"discount","percent":20},"duration_days":15}', false, 16),

('cliente-diamante','Cliente Diamante','Clientes que ultrapassam R$2.000 em consumo ganham status Diamante.','crescimento','advanced','Gem','#06b6d4',
 '["Benefícios VIP máximos","Reconhecimento exclusivo","Atendimento dedicado"]',
 '{"rule_type":"spend","target":2000,"reward":{"type":"status","label":"Diamante","perks":["concierge","priority","exclusive_gifts"]}}', false, 17),

('programa-corporativo','Programa Corporativo','Empresas conveniadas com regras de desconto próprias.','personalizadas','advanced','Building','#64748b',
 '["Convênios B2B","Descontos por volume","Faturamento mensal"]',
 '{"rule_type":"corporate","minimum_employees":5,"discount_percent":15}', false, 18),

('meta-anual','Meta Anual','Atingir R$5.000 em consumo no ano libera Plano Premium ou brinde especial.','crescimento','advanced','Trophy','#f59e0b',
 '["Recompensa anual","Cliente premium","Alto valor agregado"]',
 '{"rule_type":"spend","period":"year","target":5000,"reward":{"type":"upgrade","plan":"premium"}}', false, 19),

('fidelidade-personalizada','Fidelidade Personalizada','Template em branco. Crie sua campanha do zero.','personalizadas','easy','Sparkles','#a78bfa',
 '["Total liberdade","Regras próprias","Comece do zero"]',
 '{"rule_type":"custom","target":0,"reward":{"type":"custom"}}', false, 20);
