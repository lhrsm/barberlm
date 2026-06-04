import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { FLOW_TYPES, AUTOMATION_V2_STATES } from "../_shared/automation-v2-constants.ts";
import { processSingleFlow } from "./handlers/single.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { tenantId, action, workflow_id, phone, test_type, appointment_id } = await req.json();

    // ACTION: TEST SEND
    if (action === "test_send") {
        console.log(`[automation-v2-runner] Action: test_send for workflow ${workflow_id}`);
        
        const { data: workflow } = await supabase
            .from("automation_v2_workflows")
            .select("*")
            .eq("id", workflow_id)
            .single();
        
        if (!workflow) throw new Error("Workflow not found");

        let contextData: any = {};
        if (test_type === "real" && appointment_id) {
            const { data: appt } = await supabase
                .from("appointments")
                .select("*, customers(*), services(*), profiles(*), barbers(*)")
                .eq("id", appointment_id)
                .single();
            contextData = appt;
        } else {
            // Dummy data
            contextData = {
                customers: { name: "Cliente Teste" },
                profiles: { full_name: "Barbearia Modelo" },
                services: { name: "Corte e Barba", price: 50 },
                barbers: { name: "Barbeiro Mestre" },
                start_time: new Date().toISOString(),
                status: "Confirmado",
                payment_method: "PIX"
            };
        }

        // We can use a temporary item to call processSingleFlow
        const tempItem = {
            id: `test_${Date.now()}`,
            tenant_id: workflow.tenant_id,
            workflow_key: workflow.workflow_key,
            appointment_id: appointment_id || null,
            payload: { phone }
        };

        // In a real test, we might want to skip session creation if it's just a message preview
        // but for now let's just use the existing handler if possible, or extract the logic
        const result = await processSingleFlow(supabase, tempItem);

        return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // NORMAL QUEUE PROCESSING
    // 0. Cleanup timeouts (2 mins)
    const timeoutThreshold = new Date(Date.now() - 120 * 1000).toISOString();
    await supabase.from("automation_v2_queue")
      .update({ status: "failed", error: "processing_timeout", finished_at: new Date().toISOString() })
      .eq("status", "processing")
      .lt("started_at", timeoutThreshold);

    // 1. Fetch pending
    const { data: queueItems, error: fetchError } = await supabase
      .from("automation_v2_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;
    if (!queueItems || queueItems.length === 0) {
        return new Response(JSON.stringify({ message: "Queue empty" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const item of queueItems) {
        try {
            await supabase.from("automation_v2_queue").update({ 
                status: "processing", 
                started_at: new Date().toISOString(),
                attempts: (item.attempts || 0) + 1 
            }).eq("id", item.id);

            // Flow Detection (Override)
            let flowType = FLOW_TYPES.SINGLE;
            if (item.appointment_group_id) {
                const { count } = await supabase.from("appointments")
                    .select("*", { count: "exact", head: true })
                    .eq("appointment_group_id", item.appointment_group_id);
                if (count && count > 1) flowType = FLOW_TYPES.MULTI;
            }

            await supabase.from("automation_v2_queue").update({ flow_type: flowType }).eq("id", item.id);

            if (flowType === FLOW_TYPES.SINGLE) {
                await processSingleFlow(supabase, item);
            } else {
                console.log("[automation-v2-runner] Multi flow not yet implemented");
            }

            console.log(`[automation-v2-runner] Processing ${item.id} - Flow: ${flowType}`);


            await supabase.from("automation_v2_queue").update({ 
                status: "completed", 
                finished_at: new Date().toISOString() 
            }).eq("id", item.id);

        } catch (itemError: any) {
            console.error(`[automation-v2-runner] Error processing item ${item.id}:`, itemError);
            await supabase.from("automation_v2_queue").update({ 
                status: "failed", 
                error: itemError.message,
                finished_at: new Date().toISOString() 
            }).eq("id", item.id);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[automation-v2-runner] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});