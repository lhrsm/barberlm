-- Add source column if not exists
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source text DEFAULT 'admin';

-- Backfill tenant_id from user_id for existing records where tenant_id is null
-- Assuming user_id is the profile ID for most records
UPDATE public.appointments SET tenant_id = user_id WHERE tenant_id IS NULL;

-- If there are still records with null tenant_id, we might need to find the correct profile
-- But for now, ensuring future inserts have it is key.

-- Update triggers or constraints if needed
-- ALTER TABLE public.appointments ALTER COLUMN tenant_id SET NOT NULL; -- Might be too aggressive if some auth flows differ
