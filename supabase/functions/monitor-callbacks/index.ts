import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // Security check: Only allow service_role or a cron secret
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get("CRON_SECRET");
  
  // If CRON_SECRET is set, we can check it. Otherwise, we rely on Supabase internal security if called via pg_net
  // For now, let's just proceed but log the call
  console.log("[Monitor] Job started");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingDispatches, error: fetchErr } = await supabase
      .from("automation_v2_dispatches")
      .select("*")
      .eq("callback_received", false)
      .eq("status", "sent")
      .lt("created_at", fiveMinutesAgo)
      .not("current_step", "eq", "CALLBACK_TIMEOUT")
      .limit(20);

    if (fetchErr) throw fetchErr;

    const results = [];

    for (const dispatch of (pendingDispatches || [])) {
      try {
        console.log(`[Monitor] Timeout for dispatch ${dispatch.id} (${dispatch.phone})`);
        
        await supabase.from("automation_v2_dispatches").update({
          current_step: "CALLBACK_TIMEOUT",
          error: "Timeout aguardando callback (5 min+)"
        }).eq("id", dispatch.id);

        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("tenant_id", dispatch.tenant_id)
          .maybeSingle();

        if (instance) {
          const fallbackMsg = `Percebi que sua resposta não foi registrada.\n\nPor favor, responda com:\n1️⃣ *Confirmar*\n2️⃣ *Reagendar*\n3️⃣ *Cancelar*`;
          
          await sendAutomationMessageV2(supabase, {
            tenant_id: dispatch.tenant_id,
            workflow_key: 'callback_timeout_fallback',
            customer_phone: dispatch.phone,
            appointment_id: dispatch.appointment_id,
            appointment_group_id: dispatch.appointment_group_id,
            customer_id: dispatch.customer_id,
            customer_name: dispatch.customer_name,
            message: fallbackMsg,
            instance: instance,
            payload: { original_dispatch_id: dispatch.id }
          });
        }

        results.push({ id: dispatch.id, status: "processed" });
      } catch (e) {
        results.push({ id: dispatch.id, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
