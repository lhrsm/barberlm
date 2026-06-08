import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log('[RunAutomations] Universal processing started...');

    // 1. Process standard automation engine (Reminders, Birthdays)
    console.log('[RunAutomations] Triggering automation-engine...');
    const { data: engineData, error: engineError } = await supabase.functions.invoke('automation-engine', {
      body: { action: 'run' }
    });
    if (engineError) console.error('[RunAutomations] Engine error:', engineError);

    // 2. Explicitly trigger process-automation-queue to ensure immediate items are handled
    // The automation-engine might already call this, but we do it again for redundancy
    console.log('[RunAutomations] Triggering process-automation-queue...');
    const { data: queueData, error: queueError } = await supabase.functions.invoke('process-automation-queue', {
      body: {}
    });
    if (queueError) console.error('[RunAutomations] Queue error:', queueError);

    console.log('[RunAutomations] All processes finished.');

    return new Response(JSON.stringify({ 
      success: true, 
      engine_result: engineData,
      queue_result: queueData,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[RunAutomations] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
