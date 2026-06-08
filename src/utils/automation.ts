import { supabase } from "@/integrations/supabase/client";

interface AutomationTriggerParams {
  tenant_id: string;
  event_name: string;
  appointment_id: string;
}

/**
 * Triggers an automation event by creating a queue item and invoking the processing edge function.
 */
export const triggerAutomation = async ({
  tenant_id,
  event_name,
  appointment_id
}: AutomationTriggerParams) => {
  console.log(`[Automation] Triggering ${event_name} for appointment ${appointment_id}`);
  
  const anySupabase = supabase as any;
  
  try {
    // 1. Find the relevant automation template
    // We map frontend events to automation keys
    let workflowKey = "appointment_confirmation";
    if (event_name === 'appointment.cancelled') workflowKey = "cancellation";
    else if (event_name === 'appointment.rescheduled') workflowKey = "appointment_confirmation"; // Rescheduled also uses confirmation template usually

    const { data: template } = await anySupabase
      .from("automation_templates")
      .select("id, active")
      .eq("tenant_id", tenant_id)
      .eq("key", workflowKey)
      .maybeSingle();

    const automationId = template?.id;

    // 2. Create entry in automation_queue to ensure it's processed
    // This provides a fallback if the edge function call fails
    const { data: queueItem, error: queueError } = await anySupabase.from("automation_queue").insert({
      tenant_id,
      automation_id: automationId,
      appointment_id,
      event_name,
      workflow_key: workflowKey,
      status: "pending",
      attempts: 0,
      scheduled_for: new Date().toISOString()
    }).select().single();

    if (queueError) {
       console.error("[Automation] Error creating queue item:", queueError);
    }

    // 3. Diagnostic log: start
    if (automationId) {
      await anySupabase.from("automation_logs").insert({
        tenant_id,
        automation_id: automationId,
        appointment_id,
        status: "pending",
        message_type: "diagnostic",
        payload: { 
          diagnostic: "trigger_called", 
          event_name, 
          workflow_key: workflowKey,
          template_found: !!template,
          template_active: template?.active,
          source: "frontend_trigger",
          queue_id: queueItem?.id
        }
      });
    } else {
      console.warn("[Automation] No template found for", workflowKey);
    }

    // 4. Invoke the processing edge function to handle the queue immediately
    const { data, error } = await supabase.functions.invoke('process-automation-queue', {
      body: { 
        tenant_id, 
        workflow_key: workflowKey,
        appointment_id,
        force_resend: false
      }
    });

    if (error) {
      console.error("[Automation] Error invoking process-automation-queue:", error);
      if (automationId) {
        await anySupabase.from("automation_logs").insert({
          tenant_id,
          automation_id: automationId,
          appointment_id,
          status: "error",
          message_type: "diagnostic",
          payload: { 
            diagnostic: "process_queue_error", 
            error: error.message 
          }
        });
      }
      return { success: false, error };
    }

    console.log("[Automation] Process queue response:", data);
    return { success: true, data };
  } catch (err: any) {
    console.error("[Automation] Unexpected error:", err);
    return { success: false, error: err };
  }
};
