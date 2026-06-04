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
    const body = await req.json();
    const { tenantId, action, workflow_id, phone, test_type, appointment_id } = body;

    console.log("AUTOMATION V2 RUNNER START", { action, tenantId, workflow_id, phone });

    // ACTION: TEST SEND
    if (action === "test_send") {
        console.log(`[automation-v2-runner] Action: test_send for workflow ${workflow_id}`);
        
        try {
            const { data: workflow, error: workflowError } = await supabase
                .from("automation_v2_workflows")
                .select("*")
                .eq("id", workflow_id)
                .single();
            
            if (workflowError) {
                console.error("Error fetching workflow:", workflowError);
                throw new Error(`Workflow not found: ${workflowError.message}`);
            }
            if (!workflow) throw new Error("Workflow not found");

            console.log("TEST CONTEXT DATA START", { test_type, appointment_id, workflow_key: workflow.workflow_key });

            let contextData: any = {};
            if (test_type === "real" && appointment_id) {
                const { data: appt, error: apptError } = await supabase
                    .from("appointments")
                    .select("*, customers(*), services(*), profiles(*), barbers(*)")
                    .eq("id", appointment_id)
                    .single();
                
                if (apptError) {
                    console.error("Error fetching appointment for test:", apptError);
                    throw new Error(`Appointment for test not found: ${apptError.message}`);
                }
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

            // Temporary item to call processSingleFlow
            const tempItem = {
                id: `test_${Date.now()}`,
                tenant_id: workflow.tenant_id,
                workflow_key: workflow.workflow_key,
                appointment_id: appointment_id || null,
                payload: { phone }
            };

            const result = await processSingleFlow(supabase, tempItem);

            // Log successful test execution
            await supabase.from("automation_v2_logs").insert({
                tenant_id: workflow.tenant_id,
                event_name: 'test_execution',
                workflow_key: workflow.workflow_key,
                appointment_id: appointment_id || null,
                action: "test_send",
                status: "success",
                message: `Teste enviado com sucesso para ${phone}`,
                payload: body
            });

            return new Response(JSON.stringify({ success: true, result }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        } catch (testError: any) {
            console.error("AUTOMATION TEST EXECUTION ERROR", {
                message: testError.message,
                stack: testError.stack,
                tenantId,
                workflow_id
            });

            // Log failed test execution
            await supabase.from("automation_v2_logs").insert({
                tenant_id: tenantId || null,
                event_name: 'test_execution',
                action: "test_send",
                status: "failed",
                message: `Erro ao executar teste: ${testError.message}`,
                error: testError.message,
                payload: body,
                metadata: { stack: testError.stack }
            });

            return new Response(JSON.stringify({ 
                success: false, 
                error: testError.message,
                details: testError.stack,
                hint: "Verifique os logs de automação para mais detalhes."
            }), { 
                status: 200, // Return 200 so the frontend can read the body error
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // NORMAL QUEUE PROCESSING
    const timeoutThreshold = new Date(Date.now() - 120 * 1000).toISOString();
    await supabase.from("automation_v2_queue")
      .update({ status: "failed", error: "processing_timeout", finished_at: new Date().toISOString() })
      .eq("status", "processing")
      .lt("started_at", timeoutThreshold);

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
    return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack
    }), { 
        status: 200, // Frontend should handle success: false
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});