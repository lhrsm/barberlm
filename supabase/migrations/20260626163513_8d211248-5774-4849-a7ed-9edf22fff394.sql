
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS related_entity_id uuid,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.admin_notifications SET message = description WHERE message IS NULL AND description IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications (is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON public.admin_notifications (priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND cmd='DELETE') THEN
    CREATE POLICY "Super admin pode excluir notificações" ON public.admin_notifications
      FOR DELETE USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'super_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND cmd='INSERT') THEN
    CREATE POLICY "Sistema/super admin pode inserir notificações" ON public.admin_notifications
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_type text, p_title text, p_message text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL,
  p_related_entity_type text DEFAULT NULL, p_related_entity_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL, p_priority text DEFAULT 'normal'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.admin_notifications
    (type, title, description, message, tenant_id, user_id, related_entity_type, related_entity_id, action_url, priority, is_read)
  VALUES
    (p_type, p_title, p_message, p_message, p_tenant_id, p_user_id, p_related_entity_type, p_related_entity_id, p_action_url, p_priority, false)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role IS DISTINCT FROM 'super_admin' AND NEW.tenant_id IS NOT NULL THEN
    v_name := COALESCE(NEW.barbershop_name, NEW.display_name, NEW.email, 'Nova barbearia');
    PERFORM public.create_admin_notification(
      'new_tenant', 'Nova barbearia cadastrada',
      v_name || ' iniciou teste grátis no Barbex.',
      NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/tenants', 'normal'
    );
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_new_tenant ON public.profiles;
CREATE TRIGGER trg_admin_notify_new_tenant AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_new_tenant();

CREATE OR REPLACE FUNCTION public.tg_admin_notify_plan_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text; v_new text; v_name text;
  v_rank jsonb := '{"starter":1,"pro":2,"elite":3}'::jsonb;
BEGIN
  v_old := COALESCE(OLD.effective_plan, OLD.plan);
  v_new := COALESCE(NEW.effective_plan, NEW.plan);
  IF v_old IS DISTINCT FROM v_new AND v_new IS NOT NULL THEN
    v_name := COALESCE(NEW.barbershop_name, NEW.display_name, NEW.email, 'Barbearia');
    IF (v_rank->>v_new)::int > COALESCE((v_rank->>v_old)::int, 0) THEN
      PERFORM public.create_admin_notification('plan_upgraded','Upgrade de plano',
        v_name || ' fez upgrade: ' || COALESCE(v_old,'—') || ' → ' || v_new,
        NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/subscriptions', 'high');
    ELSE
      PERFORM public.create_admin_notification('plan_downgraded','Downgrade de plano',
        v_name || ' fez downgrade: ' || COALESCE(v_old,'—') || ' → ' || v_new,
        NEW.tenant_id, NEW.id, 'profile', NEW.id, '/admin/subscriptions', 'normal');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_plan_change ON public.profiles;
CREATE TRIGGER trg_admin_notify_plan_change AFTER UPDATE OF plan, effective_plan ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_plan_change();

CREATE OR REPLACE FUNCTION public.tg_admin_notify_support_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_admin_notification('support_ticket_created','Novo chamado de suporte',
    COALESCE(NEW.title,'Chamado aberto'),
    NEW.barbershop_id, NEW.user_id, 'support_ticket', NEW.id, '/admin/support', 'high');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_admin_notify_support_ticket AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_support_ticket();

CREATE OR REPLACE FUNCTION public.tg_admin_notify_support_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF COALESCE(NEW.is_admin_reply,false) = false THEN
    SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
    PERFORM public.create_admin_notification('support_ticket_replied','Resposta em chamado de suporte',
      COALESCE(LEFT(NEW.message,120),'Nova mensagem do cliente'),
      v_ticket.barbershop_id, NEW.sender_id, 'support_ticket', NEW.ticket_id, '/admin/support', 'normal');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_support_reply ON public.support_messages;
CREATE TRIGGER trg_admin_notify_support_reply AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_support_reply();

CREATE OR REPLACE FUNCTION public.tg_admin_notify_saas_checkout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status IN ('paid','complete','succeeded')) OR
     (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','complete','succeeded')) THEN
    PERFORM public.create_admin_notification('subscription_paid','Pagamento recebido',
      'Nova assinatura paga via Stripe.',
      NEW.tenant_id, NEW.user_id, 'saas_checkout_session', NEW.id, '/admin/subscriptions', 'high');
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('failed','payment_failed','canceled_failed')) THEN
    PERFORM public.create_admin_notification('subscription_failed','Pagamento falhou',
      'Assinatura falhou no checkout do Stripe.',
      NEW.tenant_id, NEW.user_id, 'saas_checkout_session', NEW.id, '/admin/subscriptions', 'critical');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_saas_checkout ON public.saas_checkout_sessions;
CREATE TRIGGER trg_admin_notify_saas_checkout AFTER INSERT OR UPDATE ON public.saas_checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_saas_checkout();

CREATE OR REPLACE FUNCTION public.tg_admin_notify_lgpd()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.accepted_privacy = false OR NEW.source = 'deletion_request' THEN
    PERFORM public.create_admin_notification('lgpd_request','Solicitação LGPD',
      'Cliente registrou solicitação relacionada a privacidade/LGPD.',
      NEW.tenant_id, NEW.user_id, 'privacy_consent', NEW.id, '/admin/tenants', 'high');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_admin_notify_lgpd ON public.privacy_consents;
CREATE TRIGGER trg_admin_notify_lgpd AFTER INSERT ON public.privacy_consents
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_lgpd();
