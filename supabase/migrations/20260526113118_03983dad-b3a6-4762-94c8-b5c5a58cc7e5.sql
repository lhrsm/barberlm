-- Drop existing cron job
SELECT cron.unschedule('run-automations-every-5-minutes');

-- Create new cron job with hardcoded URL and service role key
-- Replace with actual values from project info
SELECT cron.schedule(
  'run-automations-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/run-automations',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeGhqd29keWN0Z3pxdG9na2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg2ODAyOSwiZXhwIjoyMDkzNDQ0MDI5fQ.26R8TT2iA2F4IQGcGzZposIzLQOVB1Baw0TiyJDi5aA'
      ),
      body:=jsonb_build_object('scheduled', true)
    ) as request_id;
  $$
);

-- Create a function to check cron status safely
CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  last_run timestamp with time zone,
  status text,
  return_message text,
  start_time timestamp with time zone,
  end_time timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.jobname,
    r.start_time as last_run,
    r.status,
    r.return_message,
    r.start_time,
    r.end_time
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT * FROM cron.job_run_details 
    WHERE jobid = j.jobid 
    ORDER BY start_time DESC 
    LIMIT 1
  ) r ON true
  WHERE j.jobname = 'run-automations-every-5-minutes';
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_status() TO service_role;
