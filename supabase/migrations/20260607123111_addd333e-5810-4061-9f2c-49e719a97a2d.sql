-- 1. Add birthday_year to automation_v2_dispatches if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_v2_dispatches' AND column_name='birthday_year') THEN
        ALTER TABLE public.automation_v2_dispatches ADD COLUMN birthday_year INTEGER;
    END IF;
END $$;

-- 2. Update existing birthday dispatches with the year from sent_at
UPDATE public.automation_v2_dispatches 
SET birthday_year = EXTRACT(YEAR FROM sent_at)
WHERE workflow_key = 'customer_birthday' AND birthday_year IS NULL;

-- 3. CRITICAL: Clean up ALL duplicates before creating the unique index
-- This removes any duplicates that would block the index creation
DELETE FROM public.automation_v2_dispatches
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY tenant_id, customer_id, workflow_key, birthday_year ORDER BY sent_at ASC) as rn
        FROM public.automation_v2_dispatches
        WHERE workflow_key = 'customer_birthday' 
          AND birthday_year IS NOT NULL
          AND customer_id IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- 4. Now create the unique index for birthday dispatches
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_dispatch_per_year 
ON public.automation_v2_dispatches (tenant_id, customer_id, workflow_key, birthday_year) 
WHERE (workflow_key = 'customer_birthday' AND birthday_year IS NOT NULL AND customer_id IS NOT NULL);

-- 5. Clean up duplicates in automation_queue before creating unique index
DELETE FROM public.automation_queue
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY tenant_id, customer_id, workflow_key, reference_year ORDER BY created_at ASC) as rn
        FROM public.automation_queue
        WHERE workflow_key = 'customer_birthday' 
          AND reference_year IS NOT NULL
          AND customer_id IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- 6. Create unique constraint for automation_queue
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_queue_per_year
ON public.automation_queue (tenant_id, customer_id, workflow_key, reference_year)
WHERE (workflow_key = 'customer_birthday' AND reference_year IS NOT NULL AND customer_id IS NOT NULL);

-- 7. Ensure permissions are correct
GRANT ALL ON public.automation_v2_dispatches TO service_role;
GRANT ALL ON public.automation_v2_dispatches TO authenticated;
GRANT ALL ON public.automation_queue TO service_role;
GRANT ALL ON public.automation_queue TO authenticated;
