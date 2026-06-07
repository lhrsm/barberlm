-- Add reference_year to automation_queue if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_queue' AND column_name='reference_year') THEN
        ALTER TABLE public.automation_queue ADD COLUMN reference_year INTEGER;
    END IF;
END $$;

-- Create unique index for birthday deduplication in the queue
DROP INDEX IF EXISTS idx_unique_birthday_per_year;
CREATE UNIQUE INDEX idx_unique_birthday_per_year 
ON public.automation_queue (tenant_id, customer_id, reference_year) 
WHERE workflow_key = 'customer_birthday';

-- Update the birthday check function to return birth_date
DROP FUNCTION IF EXISTS public.get_customers_with_birthday_today(integer, integer);
CREATE OR REPLACE FUNCTION public.get_customers_with_birthday_today(target_day integer, target_month integer)
 RETURNS TABLE(id uuid, tenant_id uuid, name text, phone text, birth_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.tenant_id, c.name, c.phone, c.birth_date
  FROM public.customers c
  WHERE EXTRACT(DAY FROM c.birth_date) = target_day
    AND EXTRACT(MONTH FROM c.birth_date) = target_month;
END;
$function$;