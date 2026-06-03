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

    // Call Engine
    console.log('Calling processAutomationDispatches...');
    const results = await processAutomationDispatches(supabase, { tenantId, appointmentId, forceMode });
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
