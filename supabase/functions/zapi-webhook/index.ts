import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { handleAutomationWhatsappResponse } from "../_shared/automation-engine.ts";
import { normalizePhone } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function extractPhoneFromZapiPayload(body: any): string {
  const possiblePaths = [
    body.phone,
    body.from,
    body.sender,
    body.message?.phone,
    body.message?.from,
    body.data?.phone,
    body.data?.from,
    body.chatId,
    body.key?.remoteJid
  ];

  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      let phone = val.split('@')[0];
      phone = phone.replace(/\D/g, "");
      if (phone.length >= 10) return phone;
    }
  }
  return "";
}

function extractSelectedOption(body: any): string {
  // Priority 1: Direct ID from button or list responses
  const idPaths = [
    body.buttonReply?.id,
    body.buttonsResponseMessage?.selectedButtonId,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.selectedRowId,
    body.selectedId
  ];

  for (const id of idPaths) {
    if (id && typeof id === 'string') return id.trim();
  }

  // Priority 2: Text/Title responses
  const textPaths = [
    body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedDisplayText,
    body.listResponseMessage?.title,
    body.message?.listResponseMessage?.title,
    body.text,
    body.body,
    body.message?.text,
    body.message?.body,
    body.message?.content
  ];

  for (const val of textPaths) {
    if (val && typeof val === 'string') {
      return val.trim();
    }
  }
  return "";
}



async function processZapiWebhook(supabase: any, body: any, barberId: string) {
  console.log(`[Z-API] Processing webhook for barber ${barberId}`);
  const phone = extractPhoneFromZapiPayload(body);
  const normalizedPhone = normalizePhone(phone);
  const eventType = body.type || 'unknown';
  
  // 1. Log the webhook
  const ignoredEvents = [
    'PresenceChatCallback',
    'StatusCallback',
    'MessageStatusCallback',
    'DeliveredCallback',
    'ReadCallback',
    'ConnectedCallback',
    'DisconnectedCallback'
  ];
  
  const isIgnored = ignoredEvents.includes(eventType);
  
  const { data: logEntry, error: logError } = await supabase
    .from("zapi_webhook_logs")
    .insert({
      barber_id: barberId.length > 40 ? null : barberId, // UUID check
      payload: body,
      phone: normalizedPhone,
      event_type: eventType,
      ignored: isIgnored,
      processed: false
    })
    .select()
    .single();

  if (logError) {
    console.error("[Z-API] Error logging webhook:", logError);
    return;
  }

  if (isIgnored || body.fromMe === true || body.isSentByMe === true) {
    console.log(`[Z-API] Event ${eventType} ignored. (isIgnored: ${isIgnored}, fromMe: ${body.fromMe})`);
    return;
  }

  // 2. Process only message-like events
  const allowedEvents = [
    'ReceivedCallback',
    'MessageCallback',
    'TextMessage',
    'ButtonCallback',
    'ListResponseCallback'
  ];

  if (!allowedEvents.includes(eventType) && !body.text && !body.buttonReply && !body.message) {
    console.log(`[Z-API] Event ${eventType} not in allowed list and no message body found.`);
    return;
  }

  const selectedOptionRaw = extractSelectedOption(body);
  console.log('WEBHOOK RECEIVED', JSON.stringify(body));
  console.log('EXTRACTED PHONE', normalizedPhone);
  console.log('EXTRACTED OPTION', selectedOptionRaw);

  if (!normalizedPhone) {
    console.error("[Z-API] Could not extract phone from payload");
    await supabase.from("zapi_webhook_logs").update({ error: "No phone extracted" }).eq("id", logEntry.id);
    return;
  }

  // 3. Find active conversation
  let { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("phone", normalizedPhone)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: altConv } = await supabase
      .from("automation_conversations")
      .select("*, tenant_id, current_state")
      .eq("phone_normalized", normalizedPhone)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (altConv) {
      conversation = {
        id: altConv.id,
        barber_id: altConv.tenant_id,
        phone: altConv.phone_normalized,
        state: altConv.current_state,
        active: true,
        appointment_group_id: altConv.appointment_ids?.[0],
        context: altConv
      };
    }
  }

  if (!conversation) {
    console.log("[Z-API] No active conversation found for phone:", normalizedPhone);
    await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    return;
  }

  // 4. Process state machine
  try {
    const result = await handleAutomationWhatsappResponse(supabase, {
      tenant_id: conversation.barber_id,
      phone: normalizedPhone,
      customer_id: conversation.customer_id,
      current_state: conversation.state,
      option_id: selectedOptionRaw,

      payload: body,
      conversation_id: conversation.id
    });

    if (result) {
      const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
      if (connection && result.message_to_send) {
        const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send, {
          buttons: result.buttons,
          list: result.list
        });

        
        await supabase.from("automation_logs").insert({
          barber_id: conversation.barber_id,
          tenant_id: conversation.barber_id,
          phone: normalizedPhone,
          webhook_type: 'webhook_response',
          selected_option_raw: selectedOptionRaw,
          selected_option_normalized: result.selected_option_normalized || selectedOptionRaw,
          conversation_id: conversation.id,
          state_before: conversation.state,
          state_after: result.next_state,
          action: result.action_executed,
          message_sent: result.message_to_send,
          zapi_response: sendResult.response,
          status: sendResult.success ? 'success' : 'error',
          error_message: sendResult.error,
          direction: 'outgoing',
          appointment_group_id: conversation.appointment_group_id,
          appointment_id: conversation.appointment_id,
          metadata: {
            appointments_count: result.appointments_count || 0,
            is_multiple: result.is_multiple || false
          }
        });

      }
    }

    await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
  } catch (error: any) {
    console.error("[Z-API] Processing error:", error);
    await supabase.from("zapi_webhook_logs").update({ error: error.message }).eq("id", logEntry.id);
  }
}

serve(async (req) => {
  console.log('EDGE FUNCTION STARTED: zapi-webhook');
  console.log('REQUEST METHOD:', req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const barberId = pathParts[pathParts.length - 1];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    console.log('REQUEST BODY:', body);

    // Process in background to respond fast
    processZapiWebhook(supabase, body, barberId).catch(err => {
      console.error("[Z-API Background Error]", err);
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Z-API Webhook] Request error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
