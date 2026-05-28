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
  // Remove "55" if it's there twice or something weird, but standard is CC+DDD+Number
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

function extractSelectedOption(payload: any) {
  let text = "";
  let id = "";

  // Log full payload for debugging if needed
  // console.log("[Z-API Webhook] Extracting option from:", JSON.stringify(payload));

  const possiblePaths = [
    payload.message?.listResponseMessage?.title,
    payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    payload.listResponseMessage?.title,
    payload.listResponseMessage?.singleSelectReply?.selectedRowId,
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
       payload.listResponseMessage?.singleSelectReply?.selectedRowId ||
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const tenantIdFromUrl = pathParts[pathParts.length - 1]; // Fallback tenant ID from URL path

    const body = await req.json();
    const headers = Object.fromEntries(req.headers.entries());
    
    // 0. INITIAL LOG (Save everything immediately)
    const { data: debugLog, error: debugError } = await supabase
      .from("zapi_webhook_debug")
      .insert({
        payload_raw: body,
        headers_raw: headers,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (debugError) {
      console.error("[Z-API Webhook] Error creating initial debug log:", debugError);
    }

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
      
      if (debugLog) {
        await supabase.from("zapi_webhook_debug")
          .update({ processed: true })
          .eq("id", debugLog.id);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "ReceivedMessage") {
      const normalizedPhone = normalizePhone(phone);
      const option = extractSelectedOption(body);
      const messageText = String(body.text?.message || body.message?.text || body.text || body.body || "").trim();
      
      // If the message is just a number, prioritize it as the option.id
      let identifiedOptionId = option.id;
      if (!identifiedOptionId && /^\d+$/.test(messageText)) {
        identifiedOptionId = messageText;
      }

      // Update debug log with extracted info
      if (debugLog) {
        await supabase.from("zapi_webhook_debug")
          .update({
            phone_raw: phone,
            phone_normalized: normalizedPhone,
            message_text: messageText,
            option_id: identifiedOptionId
          })
          .eq("id", debugLog.id);
      }

      console.log(`[Z-API Webhook] Payload Recebido:`, JSON.stringify(body));
      console.log(`[Z-API Webhook] Phone: ${normalizedPhone}`);
      console.log(`[Z-API Webhook] Message Text: ${messageText}`);
      console.log(`[Z-API Webhook] Option ID: ${identifiedOptionId}`);

      // 1. Find the tenant_id by instanceId
      let tenantId = "";
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("tenant_id")
        .eq("instance_id", instanceId)
        .maybeSingle();

      if (instance) {
        tenantId = instance.tenant_id;
      } else if (tenantIdFromUrl && tenantIdFromUrl.length > 20) {
        tenantId = tenantIdFromUrl;
      }

      if (!tenantId) {
        return new Response(JSON.stringify({ success: false, error: "Instance not identified" }), { status: 200, headers: corsHeaders });
      }

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

      let actionExecuted = "none";
      let nextState = "none";

      if (conversation) {
        console.log(`[Z-API Webhook] Conversa Encontrada: ${conversation.id}, State: ${conversation.current_state}`);

        // 3. Process via Automation Engine
        const result = await handleAutomationWhatsappResponse(supabase, {
          tenant_id: tenantId,
          phone: normalizedPhone,
          customer_id: conversation.customer_id,
          automation_type: conversation.automation_type,
          current_state: conversation.current_state,
          option_id: identifiedOptionId,
          payload: body
        });

        if (result) {
          actionExecuted = result.action_executed;
          nextState = result.next_state;
          const connection = await getWhatsAppSettings(supabase, tenantId);
          if (connection && result.message_to_send) {
            const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send);
            
            // Log outgoing message
            await supabase.from("automation_logs").insert({
              tenant_id: tenantId,
              automation_id: conversation.automation_id,
              conversation_id: conversation.id,
              customer_id: conversation.customer_id,
              phone: normalizedPhone,
              direction: 'outgoing',
              processed_template: result.message_to_send,
              status: sendResult.success ? 'success' : 'error',
              error_message: sendResult.error,
              sent_at: new Date().toISOString()
            });
          }
        }

        // Log incoming response with detailed debug info
        await supabase.from("automation_logs").insert({
          tenant_id: tenantId,
          conversation_id: conversation.id,
          customer_id: conversation.customer_id,
          phone: normalizedPhone,
          direction: 'incoming',
          processed_template: messageText,
          option_id: identifiedOptionId,
          payload: body,
          status: 'success',
          metadata: {
            normalized_phone: normalizedPhone,
            identified_option: identifiedOptionId,
            current_state: conversation.current_state,
            next_state: nextState,
            action_executed: actionExecuted,
            raw_payload: body
          },
          received_at: new Date().toISOString()
        });
      } else {
        console.log(`[Z-API Webhook] Nenhuma Conversa Ativa para ${normalizedPhone}`);
        // Log unknown message
        await supabase.from("automation_logs").insert({
          tenant_id: tenantId,
          phone: normalizedPhone,
          direction: 'incoming',
          processed_template: messageText,
          payload: body,
          status: 'ignored',
          error_message: 'No active conversation found',
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
      status: 200, 
    });
  }
});
