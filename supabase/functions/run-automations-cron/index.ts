import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body;
    
    console.log('[RunAutomationsCron] Starting specialized cron for automation queue processing...', { tenant_id });

    // Step 1: Process the queue
    // We call process-automation-queue which is already designed to handle both single items and the general queue
    const { data: queueResult, error: queueError } = await supabase.functions.invoke('process-automation-queue', {
      body: { tenant_id }
    });

    if (queueError) {
      console.error("[RunAutomationsCron] Error processing queue:", queueError);
      throw queueError;
    }

    console.log('[RunAutomationsCron] Process finished:', queueResult);

    return new Response(JSON.stringify({ 
      success: true, 
      queue_result: queueResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[RunAutomationsCron] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
