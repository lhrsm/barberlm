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
    body.key?.remoteJid,
    body.participant
  ];

  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      let phone = val.split('@')[0];
      phone = phone.replace(/\D/g, "");
      if (phone.length >= 10 && phone.length <= 15) return phone;
    }
  }
  return "";
}

function extractSelectedOption(body: any): string {
  const possiblePaths = [
    // Z-API Buttons
    body.buttonReply?.id,
    body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedButtonId,
    body.buttonsResponseMessage?.selectedDisplayText,
    // Z-API List
    body.listResponseMessage?.title,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.message?.listResponseMessage?.title,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    // Standard text or body
    body.text,
    body.body,
    body.message?.text,
    body.message?.body,
    body.message?.contents,
    body.message?.caption,
    // Selected ID fields
    body.selectedRowId,
    body.selectedId,
    // Nested message object
    body.message?.buttonReply?.id,
    body.message?.buttonReply?.title
  ];

  for (const val of possiblePaths) {
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }

  return "";
}

async function processZapiWebhook(supabase: any, body: any, barberId: string) {
  const phone = extractPhoneFromZapiPayload(body);
  const normalizedPhone = normalizePhone(phone);
  const eventType = body.type || 'unknown';
  const instanceId = body.instanceId || null;
  const selectedOptionRaw = extractSelectedOption(body);
  
  console.log('--- Z-API WEBHOOK RECEIVED ---');
  console.log('BARBER:', barberId);
  console.log('PHONE:', normalizedPhone);
  console.log('TYPE:', eventType);
  console.log('OPTION:', selectedOptionRaw);
  console.log('PAYLOAD:', JSON.stringify(body));

  const ignoredEvents = [
    'PresenceChatCallback', 'StatusCallback', 'MessageStatusCallback',
    'DeliveredCallback', 'ReadCallback', 'ConnectedCallback', 'DisconnectedCallback'
  ];
  
  const isIgnored = ignoredEvents.includes(eventType) || body.fromMe === true || body.isSentByMe === true;
  
  // 1. Log to zapi_webhook_logs immediately
  const { data: logEntry, error: logError } = await supabase
    .from("zapi_webhook_logs")
    .insert({
      barber_id: barberId && barberId.length < 40 ? barberId : null,
      payload: body,
      phone: normalizedPhone,
      extracted_phone: normalizedPhone,
      event_type: eventType,
      type: eventType,
      ignored: isIgnored,
      processed: false,
      selected_option: selectedOptionRaw,
      extracted_option: selectedOptionRaw,
      instance_id: instanceId
    })
    .select()
    .single();

  if (logError) console.error("[Z-API] Error logging webhook:", logError);

  if (isIgnored) {
    console.log(`[Z-API] Event ${eventType} ignored.`);
    return { success: true, ignored: true };
  }

  if (!normalizedPhone) {
    console.error("[Z-API] Could not extract phone from payload");
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ error: "No phone extracted" }).eq("id", logEntry.id);
    return { success: false, error: "No phone extracted" };
  }

  // 2. Immediate Feedback Message
  // Mapping logic for immediate response
  const rawInput = selectedOptionRaw.toLowerCase();
  const isAction = selectedOptionRaw && (
    rawInput.includes('confirm') || 
    rawInput.includes('reagendar') || 
    rawInput.includes('cancelar') ||
    rawInput.includes('atendimento') ||
    rawInput.includes('agendamento') ||
    ['1', '2', '3'].includes(rawInput)
  );

  if (isAction) {
    try {
      const connection = await getWhatsAppSettings(supabase, barberId);
      if (connection) {
        console.log('[Z-API] Sending immediate feedback to', normalizedPhone);
        await sendMessage(connection, normalizedPhone, "✅ Clique recebido pelo sistema. Processando...");
      }
    } catch (e) {
      console.error('[Z-API] Error sending immediate feedback:', e);
    }
  }

  // 3. Find active conversation
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("phone", normalizedPhone)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    console.log("[Z-API] No active conversation found for phone:", normalizedPhone);
    const connection = await getWhatsAppSettings(supabase, barberId);
    if (connection && isAction) {
      await sendMessage(connection, normalizedPhone, "❌ Não encontrei uma conversa ativa para este atendimento.");
    }
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ processed: true, error: "No active conversation" }).eq("id", logEntry.id);
    return { success: true, warning: "No active conversation" };
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
        // Enviar confirmação específica se for main_confirm
        if (result.selected_option_normalized === 'main_confirm' && !result.is_multiple) {
           await sendMessage(connection, normalizedPhone, "✅ Confirmação recebida. Seu agendamento foi confirmado!");
        }

        const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send, {
          buttons: result.buttons,
          list: result.list
        });

        // Log to automation_logs
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
          status: sendResult.success ? 'success' : 'error',
          direction: 'outgoing',
          metadata: { raw_payload: body }
        });
      }
    }

    if (logEntry) await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    return { success: true };
  } catch (error: any) {
    console.error("[Z-API] Processing error:", error);
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ error: error.message }).eq("id", logEntry.id);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const barberId = pathParts[pathParts.length - 1];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    
    // IMPORTANT: Process SYNCHRONOUSLY for debugging as requested
    const result = await processZapiWebhook(supabase, body, barberId);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Z-API Webhook] Global error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
