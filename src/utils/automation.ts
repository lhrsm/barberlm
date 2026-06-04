import { supabase } from "@/integrations/supabase/client";

interface AutomationTriggerParams {
  tenant_id: string;
  event_name: string;
  appointment_id: string;
}

export const triggerAutomation = async ({
  tenant_id,
  event_name,
  appointment_id
}: AutomationTriggerParams) => {
  console.log(`[Automation] Triggering ${event_name} for appointment ${appointment_id}`);
  
  const anySupabase = supabase as any;
  
  try {
    // 1. Find the relevant automation template
    const { data: template } = await anySupabase
      .from("automation_templates")
      .select("id, active")
      .eq("tenant_id", tenant_id)
      .eq("trigger_event", event_name)
      .eq("key", "appointment_confirmation")
      .maybeSingle();

    const automationId = template?.id;

    // 2. Diagnostic log: start
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
          template_found: true,
          template_active: template.active,
          source: "frontend_trigger" 
        }
      });
    } else {
      console.warn("[Automation] No template found for", event_name);
    }

    // 3. Invoke the processing edge function to handle the queue immediately
    const { data, error } = await supabase.functions.invoke('process-automation-queue', {
      body: { 
        tenant_id, 
        event_name, 
        appointment_id 
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
