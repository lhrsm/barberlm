import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AUTOMATION_V2_STATES, FLOW_TYPES } from "../_shared/automation-v2-constants.ts";

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
    const payload = await req.json();
    console.log("[zapi-webhook-v2] Received payload:", JSON.stringify(payload, null, 2));

    // 1. Log Raw Webhook
    const { data: webhookLog, error: logError } = await supabase
      .from("automation_v2_webhook_logs")
      .insert({
        raw_payload: payload,
        phone_raw: payload.phone,
        phone_normalized: payload.phone?.replace(/\D/g, ""),
        button_id: payload.buttonsResponseMessage?.buttonId,
        message_text: payload.buttonsResponseMessage?.buttonText || payload.text?.message,
        reference_message_id: payload.referenceMessageId
      })
      .select()
      .single();

    if (logError) console.error("[zapi-webhook-v2] Log error:", logError);

    // 2. Filter internal/noise
    if (payload.isGroup || payload.fromMe) {
        return new Response(JSON.stringify({ success: true, message: "Ignored internal/group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (payload.type === "PresenceChatCallback" || payload.type === "MessageStatusCallback") {
         return new Response(JSON.stringify({ success: true, message: "Ignored callback type" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Process ReceivedCallback
    if (payload.type === "ReceivedCallback") {
        const phone = payload.phone?.replace(/\D/g, "");
        const buttonId = payload.buttonsResponseMessage?.buttonId;
        const refId = payload.referenceMessageId;

        // Find Session
        let sessionQuery = supabase.from("automation_v2_sessions").select("*").eq("status", "active");
        
        if (refId) {
            sessionQuery = sessionQuery.eq("provider_message_id", refId);
        } else {
            sessionQuery = sessionQuery.eq("phone", phone);
        }

        const { data: session, error: sessionError } = await sessionQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (sessionError || !session) {
            console.log("[zapi-webhook-v2] No active session found for", phone);
            return new Response(JSON.stringify({ success: true, message: "No active session" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Update Webhook Log with Session ID
        await supabase.from("automation_v2_webhook_logs").update({ session_id: session.id }).eq("id", webhookLog.id);

        console.log(`[zapi-webhook-v2] Session found: ${session.id}, Flow: ${session.flow_type}, Step: ${session.current_step}`);
        
        // Mark processed
        await supabase.from("automation_v2_webhook_logs").update({ processed: true }).eq("id", webhookLog.id);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[zapi-webhook-v2] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
