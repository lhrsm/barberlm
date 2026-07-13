
-- 1) SUPPORT TICKET CREATED / URGENT
CREATE OR REPLACE FUNCTION public.trg_notify_admin_support_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_name text;
BEGIN
  SELECT COALESCE(business_name, full_name, email) INTO v_shop_name
  FROM public.profiles WHERE id = NEW.barbershop_id;

  PERFORM public.emit_admin_event_panel(
    'support.ticket_created',
    'info',
    'Novo chamado de suporte',
    COALESCE(v_shop_name, 'Barbearia') || ' abriu: ' || NEW.title,
    NEW.barbershop_id,
    '/admin/support',
    jsonb_build_object('ticket_id', NEW.id, 'category', NEW.category, 'priority', NEW.priority)
  );

  IF NEW.priority IN ('urgent', 'high') THEN
    PERFORM public.emit_admin_event_panel(
      'support.ticket_urgent',
      'critical',
      'Chamado urgente aberto',
      COALESCE(v_shop_name, 'Barbearia') || ' — ' || NEW.title,
      NEW.barbershop_id,
      '/admin/support',
      jsonb_build_object('ticket_id', NEW.id, 'priority', NEW.priority)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_admin_support_ticket
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_support_ticket();

-- 2) REVENUE MILESTONE (per tenant, per month, per threshold)
CREATE OR REPLACE FUNCTION public.trg_notify_admin_revenue_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
  v_month_key text;
  v_total numeric;
  v_prev_total numeric;
  v_threshold numeric;
  v_shop_name text;
  v_thresholds numeric[] := ARRAY[1000, 5000, 10000, 50000, 100000];
BEGIN
  IF NEW.tenant_id IS NULL OR COALESCE(NEW.type, '') <> 'income' THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', COALESCE(NEW.created_at, now()));
  v_month_key := to_char(v_month_start, 'YYYY-MM');

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.transactions
  WHERE tenant_id = NEW.tenant_id
    AND type = 'income'
    AND created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  v_prev_total := v_total - COALESCE(NEW.amount, 0);

  SELECT COALESCE(business_name, full_name, email) INTO v_shop_name
  FROM public.profiles WHERE id = NEW.tenant_id;

  FOREACH v_threshold IN ARRAY v_thresholds LOOP
    IF v_prev_total < v_threshold AND v_total >= v_threshold THEN
      -- dedup: only fire once per (tenant, month, threshold)
      IF NOT EXISTS (
        SELECT 1 FROM public.admin_event_log
        WHERE event_key = 'revenue.milestone'
          AND tenant_id = NEW.tenant_id
          AND payload->>'month' = v_month_key
          AND (payload->>'threshold')::numeric = v_threshold
      ) THEN
        PERFORM public.emit_admin_event_panel(
          'revenue.milestone',
          'info',
          'Marco de receita atingido 🎉',
          COALESCE(v_shop_name, 'Barbearia') || ' cruzou R$ ' || to_char(v_threshold, 'FM999G999') || ' em ' || v_month_key,
          NEW.tenant_id,
          '/admin/finance',
          jsonb_build_object('threshold', v_threshold, 'total', v_total, 'month', v_month_key)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_revenue_milestone ON public.transactions;
CREATE TRIGGER trg_notify_admin_revenue_milestone
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_revenue_milestone();
