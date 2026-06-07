-- INTERNAL AUDIT REPORT: WhatsApp Automations & Interactive Flows
-- Date: 2024-06-07
-- Objective: Preparation for link-based management flow.

/*
FILES IDENTIFIED:
1. Edge Functions:
   - supabase/functions/zapi-webhook-v2/index.ts: Main processor for button clicks and text responses.
   - supabase/functions/zapi-receive-json/index.ts: Older/alternate version of webhook processor.
   - supabase/functions/_shared/automation-v2-engine.ts: Utility for sending messages and creating interactive sessions.
   - supabase/functions/process-automation-queue/index.ts: Queue processor that renders templates and attaches buttons.
   - supabase/functions/monitor-callbacks/index.ts: Job that tracks timeouts for interactive responses.
   - supabase/functions/reconcile-automations/index.ts: Manual reconciliation for missing callbacks.
   - supabase/functions/test-automation/index.ts: Mock trigger for testing with buttons.

2. Frontend Components:
   - src/routes/automations.tsx: Main dashboard showing "Pending Callbacks" and dispatch history.
   - src/components/admin/automations/AutomationEditModal.tsx: UI for editing templates and "requires_callback" flag.
   - src/components/admin/automations/AutomationTestModal.tsx: UI for simulating triggers and testing responses.
   - src/utils/whatsapp.ts: Utility for manual WhatsApp message triggering with buttons.
   - src/utils/automation.ts: Utility for triggering the automation system.

3. Database Tables Involved:
   - automation_v2_dispatches: Stores sent messages and their callback status (callback_received, requires_callback).
   - automation_v2_sessions: Tracks active interactive conversations.
   - automation_webhook_logs: Logs all incoming data from Z-API.
   - automation_queue: Stores pending messages before they are rendered and sent.
   - automation_templates: Configuration for each automation, including 'buttons' and 'requires_callback'.

FLOWS TO BE REMOVED/DEPRECATED:
- Interactive Buttons: "main_confirm", "main_reschedule", "main_cancel", "reminder_confirm", etc.
- Callback Logic: Lógica de matching message_id or phone within a 12h window.
- Status "aguardando_resposta": Replaced by direct completion/confirmation.
- Automatic Fallbacks: monitor-callbacks sending text instructions if buttons aren't clicked.

CONFLITOS POTENCIAIS:
- A coluna 'requires_callback' no banco pode forçar o sistema a esperar por algo que nunca virá.
- Gatilhos 'appointment.created' que ainda tentam anexar botões se o template não for atualizado.
- Webhooks da Z-API que tentam processar respostas e atualizar status de agendamentos de forma redundante.
*/

-- Step 1: Deprecate callback requirement for all templates
UPDATE public.automation_templates
SET requires_callback = false,
    buttons = '[]'::jsonb;

-- Step 2: Ensure any new templates created in the future don't default to buttons
-- This is handled in the frontend (src/routes/automations.tsx) but we can fix existing ones.

-- Step 3: Clear any pending interactive sessions to avoid zombie processing
UPDATE public.automation_v2_sessions
SET status = 'completed'
WHERE status = 'active';

-- Step 4: Mark interactive dispatches as finalized
UPDATE public.automation_v2_dispatches
SET requires_callback = false,
    finalized = true,
    finalized_at = now()
WHERE requires_callback = true AND finalized = false;
