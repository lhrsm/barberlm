
-- Função idempotente para semear templates de assinatura premium por tenant
CREATE OR REPLACE FUNCTION public.seed_subscription_automation_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.automation_templates (tenant_id, key, name, channel, trigger_event, template, active)
  VALUES
    (
      p_tenant_id,
      'subscription.reward_unlocked',
      'Recompensa Premium Desbloqueada',
      'whatsapp',
      'subscription.reward_unlocked',
      E'Olá {{customer_name}}! 👑\n\nVocê acaba de desbloquear uma recompensa exclusiva do seu plano *{{plan_name}}*:\n\n🎁 *{{reward_description}}*\n\nVocê já está há {{tenure_months}} meses conosco. Obrigado pela fidelidade!\n\nFale conosco para resgatar.',
      true
    ),
    (
      p_tenant_id,
      'subscription.tenure_milestone',
      'Marco de Tempo de Assinatura',
      'whatsapp',
      'subscription.tenure_milestone',
      E'Parabéns {{customer_name}}! 🎉\n\nVocê completou *{{tenure_months}} meses* como assinante do plano *{{plan_name}}*.\n\nObrigado por confiar na nossa barbearia. Continue aproveitando todos os seus benefícios exclusivos!',
      true
    )
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_subscription_automation_templates(uuid) TO authenticated, service_role;

-- Semear para todos os tenants existentes
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_subscription_automation_templates(r.id);
  END LOOP;
END $$;
