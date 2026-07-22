
CREATE OR REPLACE FUNCTION public.reconcile_expired_addons()
RETURNS TABLE(tenant_id uuid, addon_id uuid, expired_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT ta.id, ta.tenant_id, ta.addon_id, ta.current_period_end
    FROM public.tenant_addons ta
    WHERE ta.cancel_at_period_end = true
      AND ta.current_period_end IS NOT NULL
      AND ta.current_period_end < now()
      AND ta.status <> 'canceled'
  LOOP
    UPDATE public.tenant_addons
    SET status = 'canceled',
        cancelled_at = COALESCE(cancelled_at, now()),
        updated_at = now()
    WHERE id = v_rec.id;

    -- Log admin event (best effort)
    BEGIN
      INSERT INTO public.admin_event_log (event_type, payload, created_at)
      VALUES (
        'addon.expired',
        jsonb_build_object(
          'tenant_id', v_rec.tenant_id,
          'addon_id', v_rec.addon_id,
          'expired_at', v_rec.current_period_end
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    tenant_id := v_rec.tenant_id;
    addon_id := v_rec.addon_id;
    expired_at := v_rec.current_period_end;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_expired_addons() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_addons() TO service_role;

-- Unschedule previous version if exists
DO $$
BEGIN
  PERFORM cron.unschedule('reconcile-expired-addons');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconcile-expired-addons',
  '5 * * * *',
  $$ SELECT public.reconcile_expired_addons(); $$
);
