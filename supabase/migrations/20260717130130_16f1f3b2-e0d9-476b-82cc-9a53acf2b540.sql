
-- Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover jobs anteriores se existirem
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('barbex-admin-digest-daily','barbex-admin-digest-weekly');

-- Diário 11:00 UTC (= 08:00 BRT)
SELECT cron.schedule(
  'barbex-admin-digest-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://barberlm.lovable.app/api/public/hooks/admin-digest?period=daily',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjgwMjksImV4cCI6MjA5MzQ0NDAyOX0.AkwWm4CsIA3NQBmw333SddzuA5Xfz4pRmWUmJRQaPuo"}'::jsonb,
    body := '{"src":"cron"}'::jsonb
  ) as request_id;
  $$
);

-- Semanal segunda 11:00 UTC (= 08:00 BRT segunda)
SELECT cron.schedule(
  'barbex-admin-digest-weekly',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://barberlm.lovable.app/api/public/hooks/admin-digest?period=weekly',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjgwMjksImV4cCI6MjA5MzQ0NDAyOX0.AkwWm4CsIA3NQBmw333SddzuA5Xfz4pRmWUmJRQaPuo"}'::jsonb,
    body := '{"src":"cron"}'::jsonb
  ) as request_id;
  $$
);
