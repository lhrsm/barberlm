import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { handleAutomationWhatsappResponse, AUTOMATION_STATES } from "../_shared/automation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

function extractSelectedOption(payload: any) {
  let text = "";
  let id = "";

  const possiblePaths = [
    payload.message?.listResponseMessage?.title,
    payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    payload.listResponseMessage?.title,
    payload.selectedRowId,
    payload.selectedId,
    payload.buttonReply?.id,
    payload.buttonReply?.title,
    payload.buttonsResponseMessage?.selectedButtonId,
    payload.buttonsResponseMessage?.selectedDisplayText,
    payload.message?.text,
    payload.text,
    payload.body,
    payload.optionListReply?.title,
    payload.optionListReply?.id
  ];

  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      text = val;
      break;
    }
  }

  id = payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
       payload.selectedRowId || 
       payload.selectedId || 
       payload.buttonReply?.id || 
       payload.buttonsResponseMessage?.selectedButtonId ||
       payload.optionListReply?.id || "";

  return {
    id: String(id || "").trim(),
    text: String(text || "").trim()
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log("[Z-API Webhook] Payload:", JSON.stringify(body));

    const { type, phone, instanceId } = body;

    // Handle Instance Connection Status
    if (type === "Connected" || type === "Disconnected") {
      await supabase.from("whatsapp_instances")
        .update({ 
          status: type.toLowerCase(), 
          connected: type === "Connected",
          updated_at: new Date().toISOString()
        })
        .eq("instance_id", instanceId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "ReceivedMessage") {
      const normalizedPhone = normalizePhone(phone);
      const option = extractSelectedOption(body);
      const messageText = body.text?.message || body.message?.text || body.text || body.body || "";

      // 1. Find the tenant_id by instanceId
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("tenant_id")
        .eq("instance_id", instanceId)
        .maybeSingle();

      if (!instance) {
        console.error(`[Z-API Webhook] No instance found for instanceId: ${instanceId}`);
        return new Response(JSON.stringify({ success: false, error: "Instance not found" }), { status: 200, headers: corsHeaders });
      }

      const tenantId = instance.tenant_id;

      // 2. Find active conversation
      const { data: conversation } = await supabase
        .from("automation_conversations")
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        // 3. Process via Automation Engine
        const result = await handleAutomationWhatsappResponse(supabase, {
          tenant_id: tenantId,
          phone: normalizedPhone,
          customer_id: conversation.customer_id,
          automation_type: conversation.automation_type,
          current_state: conversation.current_state,
          option_id: option.id || option.text,
          payload: body
        });

        if (result) {
          const connection = await getWhatsAppSettings(supabase, tenantId);
          if (connection && result.message_to_send) {
            const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send, result.menu_to_send);
            
            // Log outgoing message
            await supabase.from("automation_logs").insert({
              tenant_id: tenantId,
              automation_id: conversation.automation_id, // Need to make sure this is stored in conversation
              conversation_id: conversation.id,
              customer_id: conversation.customer_id,
              phone: normalizedPhone,
              direction: 'outgoing',
              message: result.message_to_send,
              option_id: result.menu_to_send ? 'menu_sent' : null,
              payload: result.menu_to_send,
              status: sendResult.success ? 'success' : 'error',
              error_message: sendResult.error,
              sent_at: new Date().toISOString()
            });
          }
        }

        // Log incoming response
        await supabase.from("automation_logs").insert({
          tenant_id: tenantId,
          conversation_id: conversation.id,
          customer_id: conversation.customer_id,
          phone: normalizedPhone,
          direction: 'incoming',
          message: messageText,
          option_id: option.id,
          payload: body,
          status: 'success',
          received_at: new Date().toISOString()
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[Z-API Webhook] Global Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Always return 200 to Z-API to avoid retries if we handled it
    });
  }
});
