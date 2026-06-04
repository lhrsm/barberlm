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
  
  try {
    // 1. Diagnostic log: start
    await supabase.from("automation_logs").insert({
      tenant_id,
      appointment_id,
      status: "pending",
      message_type: "diagnostic",
      payload: { 
        diagnostic: "trigger_called", 
        event_name, 
        source: "frontend_trigger" 
      }
    });

    // 2. We can either rely on the DB trigger (which is already there) 
    // or manually insert into the queue if we want more control.
    // The DB trigger is better for consistency.
    
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
      await supabase.from("automation_logs").insert({
        tenant_id,
        appointment_id,
        status: "error",
        message_type: "diagnostic",
        payload: { 
          diagnostic: "process_queue_error", 
          error: error.message 
        }
      });
      return { success: false, error };
    }

    console.log("[Automation] Process queue response:", data);
    return { success: true, data };
  } catch (err: any) {
    console.error("[Automation] Unexpected error:", err);
    return { success: false, error: err };
  }
};
