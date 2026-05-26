-- Add realtime tables (ignoring errors if already added)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE automation_status;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant_created ON public.automation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON public.appointments(tenant_id, status);
