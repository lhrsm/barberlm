
-- Helper RPC: check if a tenant has an active add-on by key
CREATE OR REPLACE FUNCTION public.has_active_addon(
  _user_id uuid,
  _addon_key text,
  _env text DEFAULT 'live'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_addons ta
    JOIN public.saas_addons sa ON sa.id = ta.addon_id
    WHERE ta.tenant_id = _user_id
      AND sa.addon_key = _addon_key
      AND ta.environment = _env
      AND ta.status IN ('active', 'trialing', 'past_due')
      AND (ta.current_period_end IS NULL OR ta.current_period_end > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_addon(uuid, text, text) TO authenticated, service_role;

-- Ensure pg_cron / pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule old jobs if they exist (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('addons-cleanup-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('addons-reconcile-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Hourly: process add-ons flagged cancel_at_period_end whose period ended
SELECT cron.schedule(
  'addons-cleanup-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://barberlm.lovable.app/api/public/hooks/addons-cleanup',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjgwMjksImV4cCI6MjA5MzQ0NDAyOX0.AkwWm4CsIA3NQBmw333SddzuA5Xfz4pRmWUmJRQaPuo"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);

-- Daily 03:30: reconcile tenant_addons with Stripe subscription_items
SELECT cron.schedule(
  'addons-reconcile-daily',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://barberlm.lovable.app/api/public/hooks/addons-reconcile',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjgwMjksImV4cCI6MjA5MzQ0NDAyOX0.AkwWm4CsIA3NQBmw333SddzuA5Xfz4pRmWUmJRQaPuo"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);
