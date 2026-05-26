DROP FUNCTION IF EXISTS public.get_cron_status();

CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS TABLE (
  cron_job_id bigint,
  cron_job_name text,
  cron_last_run timestamp with time zone,
  cron_status text,
  cron_return_message text,
  cron_start_time timestamp with time zone,
  cron_end_time timestamp with time zone
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
    SELECT d.start_time, d.status, d.return_message, d.end_time
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid 
    ORDER BY d.start_time DESC 
    LIMIT 1
  ) r ON true
  WHERE j.jobname = 'run-automations-every-5-minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_status() TO service_role;
