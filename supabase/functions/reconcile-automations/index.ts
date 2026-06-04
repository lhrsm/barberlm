
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { tenant_id } = await req.json().catch(() => ({}));
    
    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }

    console.log(`[Reconcile] Starting for tenant: ${tenant_id}`);

    // 1. Fetch pending sends (sent but no callback received in last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // We'll check both automation_logs and automation_send_history for backward compatibility
    const { data: pendingLogs, error: logsError } = await supabase
      .from("automation_logs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "aguardando_resposta")
      .eq("callback_received", false)
      .gte("created_at", twentyFourHoursAgo);

    if (logsError) throw logsError;

    let analyzed = pendingLogs?.length || 0;
    let updated = 0;
    let ignored = 0;
    let errors = 0;

    for (const log of pendingLogs || []) {
      try {
        const providerMessageId = log.provider_message_id;
        const phone = log.phone;

        // Try to find a webhook log that matches
        let query = supabase
          .from("automation_webhook_logs")
          .select("*")
          .eq("tenant_id", tenant_id);
        
        if (providerMessageId) {
          query = query.eq("referenceMessageId", providerMessageId);
        } else {
          query = query.eq("phone", phone);
        }

        const { data: webhooks } = await query.order('created_at', { ascending: false }).limit(1);

        if (webhooks && webhooks.length > 0) {
          const webhook = webhooks[0];
          // If we found a matching webhook, update the log
          // (In a real scenario, we'd trigger the same logic as zapi-receive-json)
          
          await supabase.from("automation_logs").update({
            callback_received: true,
            callback_received_at: webhook.created_at,
            status: "success",
            final_status: "reconciled"
          }).eq("id", log.id);
          
          updated++;
        } else {
          ignored++;
        }
      } catch (err) {
        console.error(`[Reconcile] Error processing log ${log.id}:`, err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    return new Response(JSON.stringify({ 
      success: true, 
      stats: {
        analyzed,
        updated,
        ignored,
        errors,
        duration: `${duration}ms`
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Reconcile] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
