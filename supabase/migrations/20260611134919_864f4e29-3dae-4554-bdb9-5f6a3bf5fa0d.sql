DROP FUNCTION IF EXISTS public.complete_appointment(
  p_appointment_id uuid,
  p_metadata jsonb,
  p_changed_by_type text,
  p_changed_by_id uuid,
  p_source text
);