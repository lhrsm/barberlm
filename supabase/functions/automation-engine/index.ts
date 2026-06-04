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
    const { tenantId, workflowId, queueId, action } = body;
    
    console.log(`[AutomationEngine] Start. Tenant: ${tenantId || 'ALL'}, Action: ${action || 'process_queue'}`);

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
      try {
        // Mark as processing
        await supabase.from("automation_queue").update({ 
          status: "processing", 
          attempts: (item.attempts || 0) + 1,
          updated_at: new Date().toISOString()
        }).eq("id", item.id);

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
        } else if (item.appointment_id) {
          appointmentsFound = 1;
        }

        const flowTypeSelected = appointmentsFound > 1 ? FLOW_TYPES.MULTI : FLOW_TYPES.SINGLE;
        const reasonSelected = appointmentsFound > 1 ? 'group_contains_multiple_appointments' : 'group_contains_one_appointment';

        console.log(`[AutomationEngine] Item ${item.id}: Group ${groupId}, Found ${appointmentsFound}, Selected ${flowTypeSelected}`);

        // Update item in memory and in DB for UI consistency
        item.flow_type = flowTypeSelected;
        await supabase.from("automation_queue")
          .update({ flow_type: flowTypeSelected })
          .eq("id", item.id);

        let result;
        if (item.flow_type === FLOW_TYPES.MULTI) {
          result = await processMultiAppointmentAutomation(supabase, item, item.automation_workflows);
        } else {
          result = await processSingleAppointmentAutomation(supabase, item, item.automation_workflows);
        }
        
        // Mark as completed
        await supabase.from("automation_queue").update({ 
          status: "completed", 
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", item.id);

        results.push({ id: item.id, status: "completed", result });
      } catch (error: any) {
        console.error(`[AutomationEngine] Error item ${item.id}:`, error);
        await supabase.from("automation_queue").update({ 
          status: "failed", 
          error: error.message,
          updated_at: new Date().toISOString()
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
