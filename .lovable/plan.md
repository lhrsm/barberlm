# Plan: Fix Appointment Confirmation Automation and Webhook Logic

I will fix the "Confirmação de agendamento" automation to ensure action options are always sent, either via Z-API buttons or as a numbered fallback in the message text. I will also update the webhook to handle both button clicks and typed responses more robustly.

## Proposed Changes

### 1. Update `supabase/functions/run-automations/index.ts`
- Modify `processAppointmentConfirmation` to include the numbered options at the end of the message text.
- Update the local `sendMessage` function to handle the 4th parameter (`options`) and implement a try-catch logic for Z-API buttons.
- Add detailed logging for the sending process as requested.

### 2. Update `supabase/functions/_shared/whatsapp-settings.ts`
- Enhance the shared `sendMessage` function to be more robust, including the same button/fallback logic so other automations benefit from it.
- Use `send-button-list` (or try it) and fallback to `send-text` if it fails.

### 3. Update `supabase/functions/zapi-webhook/index.ts`
- Update the `awaiting_main_action` state handler to recognize 'confirm', 'cancel', 'reschedule' and their Portuguese equivalents, as well as numbered options (1, 1️⃣, 2, 2️⃣, 3, 3️⃣).
- Add logging for incoming messages and state transitions to facilitate debugging.

## Technical Details
- The fallback options will be appended to the message string in `processAppointmentConfirmation`.
- The `sendMessage` function will try to use the Z-API `send-button-list` endpoint first. If it returns an error or the request fails, it will fall back to the standard `send-text` endpoint with the already augmented message.
- Webhook matching will use `.toLowerCase()` and `.includes()` for better matching of user input.

## Verification Plan
1. Send a test confirmation message via the automation and verify it includes the numbered options in the text.
2. Check the logs to see if Z-API buttons were attempted and if a fallback occurred.
3. Simulate a user response (button click or text response) and verify the webhook processes it correctly by moving the state to `awaiting_scope_selection` or the next relevant state.
