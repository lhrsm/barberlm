-- 1. Ensure event_name and scheduled_for exist in automation_queue
ALTER TABLE public.automation_queue 
ADD COLUMN IF NOT EXISTS event_name TEXT,
ADD COLUMN IF NOT EXISTS workflow_key TEXT,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- 2. Add unique constraint for idempotency if it doesn't exist
-- tenant_id + appointment_id + workflow_key + scheduled_for (for reminders)
-- tenant_id + customer_id + workflow_key + scheduled_for (for birthdays)
-- We'll use a unique index instead of a constraint to allow NULL appointment_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_idempotency 
ON public.automation_queue (tenant_id, COALESCE(appointment_id, '00000000-0000-0000-0000-000000000000'), workflow_key, scheduled_for);

-- 3. Add customer_id to automation_queue if not present
ALTER TABLE public.automation_queue
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- 4. Grant permissions
GRANT ALL ON public.automation_queue TO authenticated;
GRANT ALL ON public.automation_queue TO service_role;
