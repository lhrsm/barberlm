import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationDispatches } from "../_shared/automation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  console.log('EDGE FUNCTION STARTED: run-automations');
  console.log('REQUEST METHOD:', req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const serverTime = new Date().toISOString();
  
  let body = {};
  try {
    body = await req.json();
    console.log('REQUEST BODY:', body);
  } catch (e) {
    console.log('NO JSON BODY OR INVALID JSON');
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tenantId, appointmentId, appointmentGroupId, forceMode } = body as any;

    // Update global status to executing
    const { data: statusRows } = await supabase.from("automation_status").select("id").limit(1);
    const globalStatusId = statusRows?.[0]?.id;

    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'executing',
        server_time: serverTime,
        updated_at: serverTime
      }).eq('id', globalStatusId);
    }

    // Process pending items in automation_queue
    console.log('Processing automation_queue...');
    const { data: queueItems, error: queueError } = await supabase
      .from("automation_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", serverTime);

    if (queueError) {
      console.error('Error fetching queue:', queueError);
    } else if (queueItems && queueItems.length > 0) {
      console.log(`Found ${queueItems.length} items to process in queue`);
      for (const item of queueItems) {
        try {
          await supabase.from("automation_queue").update({ status: 'processing', attempts: (item.attempts || 0) + 1 }).eq("id", item.id);
          
          const dispatchResult = await processAutomationDispatches(supabase, { 
            tenantId: item.tenant_id, 
            appointmentId: item.event_id, // Usually the appointment_id is stored here or in the payload
            appointmentGroupId: item.appointment_group_id 
          });

          await supabase.from("automation_queue").update({ 
            status: 'completed', 
            processed_at: new Date().toISOString() 
          }).eq("id", item.id);
        } catch (err: any) {
          console.error(`Error processing queue item ${item.id}:`, err);
          await supabase.from("automation_queue").update({ 
            status: 'failed', 
            error: err.message 
          }).eq("id", item.id);
        }
      }
    }

    // Call Engine for legacy direct dispatches
    console.log('Calling processAutomationDispatches for direct trigger...');
    const results = await processAutomationDispatches(supabase, { tenantId, appointmentId, appointmentGroupId, forceMode });
    console.log('Dispatches results:', JSON.stringify(results));

    // Update status to idle
    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'active',
        last_run: serverTime,
        last_result: results,
        updated_at: new Date().toISOString()
      }).eq('id', globalStatusId);
    }

    console.log(`[Automation Scheduler] Finished in ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[Automation Scheduler] Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
