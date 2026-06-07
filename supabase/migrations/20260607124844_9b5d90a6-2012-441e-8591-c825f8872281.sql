ALTER TABLE public.automation_v2_dispatches ADD COLUMN IF NOT EXISTS requires_callback BOOLEAN DEFAULT FALSE;

-- Update existing records based on workflow_key
UPDATE public.automation_v2_dispatches 
SET requires_callback = TRUE 
WHERE workflow_key IN ('appointment_confirmation');

UPDATE public.automation_v2_dispatches 
SET requires_callback = TRUE 
WHERE workflow_key = 'appointment_reminder' AND (payload->>'reminder_type' = '30m' OR payload->>'rendered_message' ILIKE '%Confirmar%');

-- For those that don't require callback, we can mark them as finalized/received to clean up UI
UPDATE public.automation_v2_dispatches
SET callback_received = TRUE,
    current_step = 'completed',
    status = 'sent',
    finalized = TRUE,
    finalized_at = COALESCE(finalized_at, sent_at, created_at)
WHERE requires_callback = FALSE AND callback_received = FALSE;