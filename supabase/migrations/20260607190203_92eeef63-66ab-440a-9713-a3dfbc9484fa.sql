-- 1. Deprecate callback requirement for all templates
UPDATE public.automation_templates
SET requires_callback = false,
    buttons = '[]'::jsonb;

-- 2. Clear any pending interactive sessions
UPDATE public.automation_v2_sessions
SET status = 'completed'
WHERE status = 'active';

-- 3. Mark interactive dispatches as finalized
UPDATE public.automation_v2_dispatches
SET requires_callback = false,
    finalized = true,
    finalized_at = now()
WHERE requires_callback = true AND finalized = false;

-- 4. Update the trigger/logic that might still default to buttons if called
-- (Already handled in frontend/edge function code updates)
