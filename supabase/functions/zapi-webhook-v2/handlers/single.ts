import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AUTOMATION_V2_STATES, FLOW_TYPES } from "../../_shared/automation-v2-constants.ts";

export async function handleSingleResponse(supabase: any, session: any, webhook: any) {
    const buttonId = webhook.button_id;
    console.log(`[SingleHandler] Session ${session.id}, Button: ${buttonId}`);

    if (buttonId === "main_confirm") {
        // 1. Confirm Appointment
        await supabase.from("appointments").update({ 
            status: "confirmed",
            confirmed_at: new Date().toISOString()
        }).eq("id", session.appointment_id);

        // 2. Log Transition
        await supabase.from("automation_v2_logs").insert({
            tenant_id: session.tenant_id,
            session_id: session.id,
            appointment_id: session.appointment_id,
            workflow_key: session.context?.workflow_key,
            flow_type: FLOW_TYPES.SINGLE,
            step_before: session.current_step,
            step_after: AUTOMATION_V2_STATES.SINGLE_COMPLETED,
            action: "confirm_appointment",
            status: "success"
        });

        // 3. Close Session
        await supabase.from("automation_v2_sessions").update({
            current_step: AUTOMATION_V2_STATES.SINGLE_COMPLETED,
            status: "closed",
            closed_at: new Date().toISOString()
        }).eq("id", session.id);

        // TODO: Send Success Message
    }
}
