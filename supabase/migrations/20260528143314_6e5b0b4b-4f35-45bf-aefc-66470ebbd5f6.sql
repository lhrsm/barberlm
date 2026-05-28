-- First, ensure all existing notifications have a tenant_id if possible
UPDATE public.notifications 
SET tenant_id = user_id 
WHERE tenant_id IS NULL AND user_id IS NOT NULL;

-- Create a unique index for deduplication
-- We use unique_key which should contain the event reference (e.g., appointment_id)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_idx ON public.notifications (tenant_id, type, unique_key) WHERE unique_key IS NOT NULL;
