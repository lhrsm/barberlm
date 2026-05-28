import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationDispatches } from "../_shared/automation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const serverTime = new Date().toISOString();
  
  console.log(`[Automation Scheduler] Started at ${serverTime}`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId;
    const forceMode = body.forceMode === true;

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
    const results = await processAutomationDispatches(supabase, { tenantId, forceMode });

    // Update status to idle
    if (globalStatusId) {
      await supabase.from("automation_status").update({
        status: 'active', // Changed from idle to active as per user UI request
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

  } catch (error) {
    console.error("[Automation Scheduler] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
