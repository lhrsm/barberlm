import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { FLOW_TYPES } from "../_shared/automation-engine.ts";
import { processSingleAppointmentAutomation } from "./handlers/single.ts";
import { processMultiAppointmentAutomation } from "./handlers/multi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { tenantId, workflowId, queueId, action, phone, message, buttons } = body;

    if (action === "send_test_message") {
      const { sendMessage, getWhatsAppSettings } = await import("../_shared/whatsapp-settings.ts");
      const connection = await getWhatsAppSettings(supabase, tenantId);
      if (!connection) throw new Error("WhatsApp connection not found");
      const result = await sendMessage(connection, phone, message, { buttons });
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    
    console.log(`[AutomationEngine] Start. Tenant: ${tenantId || 'ALL'}, Action: ${action || 'process_queue'}`);

    // 0. Timeout Cleanup: Mark items stuck in 'processing' for more than 2 minutes as failed
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from("automation_queue")
      .update({ 
        status: "failed", 
        error: "processing_timeout",
        updated_at: new Date().toISOString()
      })
      .eq("status", "processing")
      .lt("updated_at", twoMinutesAgo);
    
    if (cleanupError) console.error("[AutomationEngine] Cleanup error:", cleanupError);

    // 1. Fetch pending items from queue
    let query = supabase
      .from("automation_queue")
      .select(`
        *,
        automation_workflows (*)
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (workflowId) query = query.eq("workflow_id", workflowId);
    if (queueId) query = query.eq("id", queueId);

    const { data: queueItems, error: queueError } = await query;
    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const item of queueItems) {
      let lastStep = "init";
      try {
        // Mark as processing
        await supabase.from("automation_queue").update({ 
          status: "processing", 
          started_at: new Date().toISOString(),
          attempts: (item.attempts || 0) + 1,
          updated_at: new Date().toISOString()
        }).eq("id", item.id);

        lastStep = "detecting_flow";
        // 2. Flow Detection Logic (Mandatory override)
        // Rule: Only use the count of appointments in the group_id
        const groupId = item.appointment_group_id;
        let appointmentsFound = 0;
        
        if (groupId) {
          const { count, error: countError } = await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("appointment_group_id", groupId);
          
          if (!countError) {
            appointmentsFound = count || 0;
          }
        } else if (item.appointment_id || item.entity_id) {
          appointmentsFound = 1;
        }

        const flowTypeSelected = appointmentsFound > 1 ? FLOW_TYPES.MULTI : FLOW_TYPES.SINGLE;
        const reasonSelected = appointmentsFound > 1 ? 'group_contains_multiple_appointments' : 'group_contains_one_appointment';

        console.log(`[AutomationEngine] Item ${item.id}: Group ${groupId}, Found ${appointmentsFound}, Selected ${flowTypeSelected}`);

        // Update item in memory and in DB for UI consistency
        item.flow_type = flowTypeSelected;
        item.metadata = {
          ...(item.metadata || {}),
          appointments_found: appointmentsFound,
          flow_type_selected: flowTypeSelected,
          reason_selected: reasonSelected,
          last_step: lastStep
        };

        await supabase.from("automation_queue")
          .update({ 
            flow_type: flowTypeSelected,
            metadata: item.metadata
          })
          .eq("id", item.id);

        let result;
        lastStep = "executing_handler";
        if (item.flow_type === FLOW_TYPES.MULTI) {
          result = await processMultiAppointmentAutomation(supabase, item, item.automation_workflows);
        } else {
          result = await processSingleAppointmentAutomation(supabase, item, item.automation_workflows);
        }
        
        lastStep = "finalizing";
        item.metadata = {
          ...(item.metadata || {}),
          last_step: lastStep,
          zapi_response: result?.response || null,
          provider_message_id: result?.response?.messageId || null
        };

        // Mark as completed
        await supabase.from("automation_queue").update({ 
          status: "completed", 
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: item.metadata
        }).eq("id", item.id);

        results.push({ id: item.id, status: "completed", result });
      } catch (error: any) {
        console.error(`[AutomationEngine] Error item ${item.id}:`, error);
        await supabase.from("automation_queue").update({ 
          status: "failed", 
          error: error.message,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(item.metadata || {}),
            last_step: lastStep,
            error: error.message
          }
        }).eq("id", item.id);
        
        results.push({ id: item.id, status: "failed", error: error.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AutomationEngine] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
