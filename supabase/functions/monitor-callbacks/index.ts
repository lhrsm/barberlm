import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // 1. Get dispatches pending callback for more than 5 minutes
    const { data: pendingDispatches, error: fetchErr } = await supabase
      .from("automation_v2_dispatches")
      .select("*")
      .eq("callback_received", false)
      .eq("status", "sent")
      .lt("created_at", fiveMinutesAgo)
      .neq("current_step", "CALLBACK_TIMEOUT") // Avoid processing twice
      .limit(20);

    if (fetchErr) throw fetchErr;

    console.log(`[Monitor] Found ${pendingDispatches?.length || 0} pending callbacks to process.`);

    const results = [];

    for (const dispatch of (pendingDispatches || [])) {
      try {
        console.log(`[Monitor] Processing timeout for dispatch ${dispatch.id} (${dispatch.phone})`);
        
        // Mark as timeout
        await supabase.from("automation_v2_dispatches").update({
          current_step: "CALLBACK_TIMEOUT",
          error: "Timeout aguardando callback (5 min+)"
        }).eq("id", dispatch.id);

        // Send fallback message
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("tenant_id", dispatch.tenant_id)
          .maybeSingle();

        if (instance) {
          const fallbackMsg = `Percebi que sua resposta não foi registrada.\n\nPor favor, responda com:\n1️⃣ *Confirmar*\n2️⃣ *Reagendar*\n3️⃣ *Cancelar*`;
          await sendMessage(instance, dispatch.phone, fallbackMsg);
          
          // Log the action
          await supabase.from("automation_logs").insert({
            automation_id: dispatch.workflow_key === 'appointment_confirmation' ? (await supabase.from("automation_templates").select("id").eq("key", "appointment_confirmation").eq("tenant_id", dispatch.tenant_id).single()).data?.id : null,
            tenant_id: dispatch.tenant_id,
            appointment_id: dispatch.appointment_id,
            phone: dispatch.phone,
            status: "sent",
            action: "callback_timeout_fallback_sent",
            message_type: "text_fallback"
          });
        }

        results.push({ id: dispatch.id, status: "processed" });
      } catch (e) {
        console.error(`[Monitor] Error processing dispatch ${dispatch.id}:`, e);
        results.push({ id: dispatch.id, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Monitor] Global error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
