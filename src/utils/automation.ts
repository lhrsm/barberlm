import { supabase } from "@/integrations/supabase/client";

interface AutomationTriggerParams {
  tenant_id: string;
  event_name: string;
  appointment_id: string;
}

/**
 * Triggers an automation event by creating a queue item and invoking the processing edge function.
 * Optimized for reliability and includes detailed logging for audit.
 */
export const triggerAutomation = async ({
  tenant_id,
  event_name,
  appointment_id
}: AutomationTriggerParams) => {
  console.log(`[Automation] 🟢 Starting trigger for ${event_name} on appointment ${appointment_id}`);
  
  const anySupabase = supabase as any;
  
  try {
    // 1. Fetch full appointment details to validate requirements
    const { data: appointment, error: fetchError } = await anySupabase
      .from("appointments")
      .select(`
        *,
        customer:customers(id, name, phone),
        tenant:tenants(id, name)
      `)
      .eq("id", appointment_id)
      .single();

    if (fetchError || !appointment) {
      console.error("[Automation] ❌ Appointment not found:", fetchError);
      return { success: false, error: "Appointment not found" };
    }

    const customerPhone = appointment.customer?.phone;
    const managementToken = appointment.management_token;
    const customerId = appointment.customer?.id;

    // 2. Map frontend events to automation keys
    let workflowKey = "appointment_confirmation";
    if (event_name === 'appointment.cancelled') workflowKey = "cancellation";
    else if (event_name === 'appointment.rescheduled') workflowKey = "appointment_confirmation";

    // 3. Find the relevant automation in the main automations table (required for logging)
    let automationId = null;
    try {
      const { data: autoId, error: rpcError } = await anySupabase.rpc('get_or_create_automation', {
        p_tenant_id: tenant_id,
        p_type: workflowKey === 'appointment_confirmation' ? 'new_appointment' : workflowKey
      });
      
      if (!rpcError && autoId) {
        automationId = autoId;
      } else {
        console.warn("[Automation] ⚠️ Failed to get/create automation record:", rpcError);
        // Fallback: try to find any automation for this tenant
        const { data: existingAuto } = await anySupabase
          .from("automations")
          .select("id")
          .eq("tenant_id", tenant_id)
          .limit(1)
          .maybeSingle();
        automationId = existingAuto?.id;
      }
    } catch (err) {
      console.error("[Automation] ❌ Error resolving automation_id:", err);
    }

    // 4. Find the relevant automation template for enqueuing
    const { data: template } = await anySupabase
      .from("automation_templates")
      .select("id, active")
      .eq("tenant_id", tenant_id)
      .eq("key", workflowKey)
      .maybeSingle();

    const templateId = template?.id;

    // 5. Initial Audit Log: appointment_created / automation_trigger_started
    await anySupabase.from("automation_logs").insert({
      tenant_id,
      automation_id: automationId, // Now guaranteed to be a valid ID from 'automations' table or null
      appointment_id,
      customer_id: customerId,
      phone: customerPhone,
      status: "pending",
      message_type: "diagnostic",
      payload: { 
        diagnostic: "automation_trigger_started", 
        event_name, 
        workflow_key: workflowKey,
        source: "real_appointment_flow",
        automation_type: "new_appointment",
        management_token_exists: !!managementToken,
        customer_phone_exists: !!customerPhone,
        template_active: template?.active,
        has_automation_id: !!automationId,
        template_id: templateId
      }
    });

    // 5. Hard validations before sending
    if (!managementToken) {
      console.warn("[Automation] ⚠️ Missing management_token, skipping immediate send");
      return { success: false, error: "Missing management_token" };
    }

    if (!customerPhone) {
      console.warn("[Automation] ⚠️ Missing customer phone, cannot send WhatsApp");
      return { success: false, error: "Missing customer phone" };
    }

    // 6. Check if WhatsApp integration is active for this tenant
    const { data: profile } = await anySupabase
      .from("profiles")
      .select("whatsapp_enabled, whatsapp_instance_id")
      .eq("id", tenant_id)
      .single();

    if (!profile?.whatsapp_enabled || !profile?.whatsapp_instance_id) {
      console.warn("[Automation] ⚠️ WhatsApp integration not active for tenant", tenant_id);
      await anySupabase.from("automation_logs").insert({
        tenant_id,
        automation_id: automationId || null,
        appointment_id,
        status: "skipped",
        message_type: "diagnostic",
        payload: { 
          diagnostic: "whatsapp_inactive",
          whatsapp_enabled: profile?.whatsapp_enabled,
          has_instance: !!profile?.whatsapp_instance_id
        }
      });
      return { success: false, error: "WhatsApp inactive" };
    }

    // 7. Create entry in automation_queue to ensure it's processed (Fallback mechanism)
    const { data: queueItem, error: queueError } = await anySupabase.from("automation_queue").insert({
      tenant_id,
      automation_id: templateId, // Correctly point to 'automation_templates'
      appointment_id,
      event_name,
      workflow_key: workflowKey,
      status: "pending",
      attempts: 0,
      scheduled_for: new Date().toISOString()
    }).select().single();

    if (queueError) {
       console.error("[Automation] ❌ Error creating queue item:", queueError);
    }

    // 8. Payload Build Log
    await anySupabase.from("automation_logs").insert({
      tenant_id,
      automation_id: automationId || null,
      appointment_id,
      status: "pending",
      message_type: "diagnostic",
      payload: { 
        diagnostic: "automation_payload_built",
        queue_id: queueItem?.id,
        target_phone: customerPhone,
        workflow: workflowKey
      }
    });

    // 9. Invoke the processing edge function to handle it immediately
    // Using force_resend: true to ensure immediate processing similar to the test button
    console.log(`[Automation] 🚀 Invoking process-automation-queue for ${workflowKey}`);
    
    const { data, error: invokeError } = await supabase.functions.invoke('process-automation-queue', {
      body: { 
        tenant_id, 
        workflow_key: workflowKey,
        appointment_id,
        force_resend: true,
        source: 'real_appointment_flow'
      }
    });

    if (invokeError) {
      console.error("[Automation] ❌ Error invoking process-automation-queue:", invokeError);
      await anySupabase.from("automation_logs").insert({
        tenant_id,
        automation_id: automationId || null,
        appointment_id,
        status: "failed",
        error_message: invokeError.message,
        message_type: "diagnostic",
        payload: { 
          diagnostic: "whatsapp_send_failed", 
          error: invokeError.message 
        }
      });
      return { success: false, error: invokeError };
    }

    // 10. Final Success Log
    await anySupabase.from("automation_logs").insert({
      tenant_id,
      automation_id: automationId || null,
      appointment_id,
      status: "success",
      message_type: "diagnostic",
      payload: { 
        diagnostic: "whatsapp_send_success",
        response: data
      }
    });

    console.log("[Automation] ✅ Process queue response:", data);
    return { success: true, data };
  } catch (err: any) {
    console.error("[Automation] ❌ Unexpected error:", err);
    return { success: false, error: err };
  }
};
