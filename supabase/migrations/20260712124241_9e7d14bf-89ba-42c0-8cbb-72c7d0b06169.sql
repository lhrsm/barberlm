
-- SQL helper: fanout panel notifications for an admin event.
-- Used by DB triggers (webhooks call the edge function for push/whatsapp too).
CREATE OR REPLACE FUNCTION public.emit_admin_event_panel(
  p_event_key text,
  p_title text,
  p_message text DEFAULT '',
  p_severity text DEFAULT 'info',
  p_tenant_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_admin record;
  v_sub record;
  v_priority text;
BEGIN
  v_priority := CASE p_severity
    WHEN 'critical' THEN 'critical'
    WHEN 'warning' THEN 'high'
    ELSE 'normal'
  END;

  FOR v_admin IN
    SELECT id FROM public.profiles WHERE role = 'super_admin'
  LOOP
    SELECT * INTO v_sub
      FROM public.admin_event_subscriptions
      WHERE user_id = v_admin.id AND event_key = p_event_key;

    -- Default (no explicit subscription) = panel on
    IF v_sub.id IS NOT NULL AND NOT COALESCE(v_sub.enabled, true) THEN CONTINUE; END IF;
    IF v_sub.id IS NOT NULL AND NOT COALESCE(v_sub.channel_panel, true) THEN CONTINUE; END IF;

    INSERT INTO public.admin_notifications (
      user_id, event_key, type, severity, priority,
      title, message, description, tenant_id, action_url, payload
    ) VALUES (
      v_admin.id, p_event_key, p_event_key, p_severity, v_priority,
      p_title, p_message, p_message, p_tenant_id, p_action_url, p_payload
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_event_log (event_key, severity, payload, tenant_id, recipients_count, channels_delivered)
  VALUES (p_event_key, p_severity, p_payload, p_tenant_id, v_count, jsonb_build_object('panel', v_count));

  RETURN v_count;
END;
$$;

-- Trigger: new tenant signup
CREATE OR REPLACE FUNCTION public.trg_notify_admin_tenant_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only fire for shop-owner style profiles (has business_name or role = admin)
  IF NEW.business_name IS NOT NULL OR NEW.role IN ('admin', 'shop_owner') THEN
    PERFORM public.emit_admin_event_panel(
      'tenant.signup',
      'Nova barbearia cadastrada',
      COALESCE(NEW.business_name, NEW.full_name, NEW.email, 'Sem nome'),
      'info',
      NEW.id,
      '/admin/tenants',
      jsonb_build_object(
        'tenant_id', NEW.id,
        'business_name', NEW.business_name,
        'email', NEW.email,
        'plan', NEW.plan
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notify_tenant_signup ON public.profiles;
CREATE TRIGGER trg_admin_notify_tenant_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_tenant_signup();
