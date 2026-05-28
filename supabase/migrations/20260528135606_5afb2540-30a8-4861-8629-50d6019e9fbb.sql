ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS unique_key TEXT;

-- Create an index to help with deduplication queries
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON public.notifications (tenant_id, type, unique_key);

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.notifications.unique_key IS 'Key used for deduplication, usually following the format type:tenant_id:reference_id';
