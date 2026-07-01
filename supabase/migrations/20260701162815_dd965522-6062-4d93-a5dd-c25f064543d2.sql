CREATE OR REPLACE FUNCTION public.tg_admin_notify_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.effective_plan,'') IS DISTINCT FROM COALESCE(NEW.effective_plan,'') THEN
    v_name := COALESCE(NEW.display_name, NEW.email, 'Barbearia');
    BEGIN
      INSERT INTO public.admin_notifications (type, title, message, metadata)
      VALUES (
        'plan_change',
        'Plano atualizado',
        v_name || ' → ' || COALESCE(NEW.effective_plan,'—'),
        jsonb_build_object('tenant_id', NEW.id, 'from', OLD.effective_plan, 'to', NEW.effective_plan)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;