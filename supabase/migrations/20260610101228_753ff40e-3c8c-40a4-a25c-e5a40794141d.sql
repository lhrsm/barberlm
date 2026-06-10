DROP FUNCTION IF EXISTS public.complete_appointment(uuid, text, text, text, jsonb);

-- Re-create the function ensuring the desired signature if needed, 
-- or just rely on the existing UUID version. 
-- The read_query showed one exists with OID 24345: 
-- arguments: p_appointment_id uuid, p_changed_by_type text, p_changed_by_id uuid, p_source text DEFAULT 'frontend'::text, p_metadata jsonb DEFAULT '{}'::jsonb
