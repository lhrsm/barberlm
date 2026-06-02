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
  // Debug paths specifically for buttons and lists
  const possiblePaths = [
    // Z-API List Responses
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.listResponseMessage?.title,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    
    // Z-API Button Responses
    body.buttonReply?.id,
    body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedButtonId,
    body.buttonsResponseMessage?.selectedDisplayText,
    body.message?.buttonReply?.id,
    
    // Common ID fields
    body.selectedRowId,
    body.selectedId,
    
    // Standard text or body
    body.text?.message,
    body.text,
    body.body,
    body.message?.text,
    body.message?.body,
    body.message?.contents,
    body.message?.caption
  ];

  for (const val of possiblePaths) {
    if (val !== undefined && val !== null && val !== '') {
      if (typeof val === 'object' && val.message) return String(val.message).trim();
      return String(val).trim();
    }
  }

  return "";
}

async function processZapiWebhook(supabase: any, body: any, barberId: string) {
  // 1. OBLIGATORY: Log everything BEFORE any filters
  const eventType = body.type || 'unknown';
  const instanceId = body.instanceId || null;
  const phone = extractPhoneFromZapiPayload(body);
  const normalizedPhone = normalizePhone(phone);
  const selectedOptionRaw = extractSelectedOption(body);
  
  console.log('--- Z-API WEBHOOK RECEIVED ---');
  console.log('PHONE RECEIVED:', phone);
  console.log('PHONE NORMALIZED:', normalizedPhone);
  console.log('BARBER:', barberId);
  console.log('TYPE:', eventType);
  console.log('OPTION:', selectedOptionRaw);
  console.log('PAYLOAD:', JSON.stringify(body));

  // 1. Save to zapi_webhook_logs immediately
  const { data: logEntry, error: logError } = await supabase
    .from("zapi_webhook_logs")
    .insert({
      barber_id: barberId && barberId.length < 40 ? barberId : null,
      payload: body,
      phone: normalizedPhone,
      extracted_phone: normalizedPhone,
      event_type: eventType,
      type: eventType,
      processed: false,
      selected_option: selectedOptionRaw,
      extracted_option: selectedOptionRaw,
      instance_id: instanceId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (logError) console.error("[Z-API] Error logging webhook:", logError);

  // 2. Filter ignored events AFTER logging
  const ignoredEvents = [
    'PresenceChatCallback', 'StatusCallback', 'MessageStatusCallback',
    'DeliveredCallback', 'ReadCallback', 'ConnectedCallback', 'DisconnectedCallback'
  ];
  
  const isIgnored = ignoredEvents.includes(eventType) || body.fromMe === true || body.isSentByMe === true;

  if (isIgnored) {
    console.log(`[Z-API] Event ${eventType} ignored.`);
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ ignored: true }).eq("id", logEntry.id);
    return { success: true, ignored: true };
  }

  if (!normalizedPhone) {
    console.error("[Z-API] Could not extract phone from payload");
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ error: "No phone extracted" }).eq("id", logEntry.id);
    return { success: true, error: "No phone extracted" }; // Still return 200
  }

  // 3. Send immediate feedback for actions
  const rawInput = selectedOptionRaw.toLowerCase();
  const isAction = selectedOptionRaw && (
    rawInput.includes('confirm') || 
    rawInput.includes('reagendar') || 
    rawInput.includes('cancelar') ||
    rawInput.includes('atendimento') ||
    rawInput.includes('agendamento') ||
    ['1', '2', '3'].includes(rawInput) ||
    eventType === 'ListResponseCallback' ||
    eventType === 'ButtonCallback'
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

  // 4. Find active conversation
  console.log('CONVERSATION LOOKUP');
  console.log('webhook_phone:', normalizedPhone);

  const { data: conversation, error: convLookupError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("phone", normalizedPhone)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (conversation) {
    console.log('conversation_phone found:', conversation.phone);
    console.log('conversation_phone == webhook_phone:', conversation.phone === normalizedPhone);
  }

  if (conversation) {
    console.log('conversation encontrada:', conversation.id);
    console.log('state:', conversation.state);
    console.log('active:', conversation.active);
  }

  if (!conversation) {
    console.log("[Z-API] No active conversation found for phone:", normalizedPhone);
    
    // Debug search to see if there's any similar conversation
    const last8 = normalizedPhone.slice(-8);
    const { data: debugConv } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .ilike("phone", `%${last8}`)
      .limit(5);
    
    console.log(`[Z-API] Debug lookup (LIKE %${last8}):`, JSON.stringify(debugConv));

    const connection = await getWhatsAppSettings(supabase, barberId);
    if (connection && isAction) {
      await sendMessage(connection, normalizedPhone, "❌ Não encontrei uma conversa ativa para este atendimento.");
    }
    
    if (logEntry) {
      await supabase.from("zapi_webhook_logs").update({ 
        processed: true, 
        error: "No active conversation",
        metadata: { 
          ...body, 
          conversation_found: false,
          debug_matches: debugConv
        } 
      }).eq("id", logEntry.id);
    }
    
    return { success: true, warning: "No active conversation" };
  }

  // Found conversation!
  if (logEntry) {
    await supabase.from("zapi_webhook_logs").update({ 
      metadata: { 
        ...body, 
        conversation_found: true,
        conversation_id: conversation.id,
        state: conversation.state,
        active: conversation.active
      } 
    }).eq("id", logEntry.id);
  }

  // 5. Process state machine
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
          metadata: { raw_payload: body, webhook_log_id: logEntry?.id }
        });
      }
    }

    if (logEntry) await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    return { success: true };
  } catch (error: any) {
    console.error("[Z-API] Processing error:", error);
    if (logEntry) await supabase.from("zapi_webhook_logs").update({ error: error.message }).eq("id", logEntry.id);
    return { success: true, error: error.message }; // Always 200
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // The barber_id is expected to be the last part of the path or passed via header
  const barberIdFromPath = pathParts[pathParts.length - 1];
  const barberIdFromHeader = req.headers.get('x-barber-id');
  const barberId = barberIdFromHeader || barberIdFromPath;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    
    // Process synchronously and always return 200
    const result = await processZapiWebhook(supabase, body, barberId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Z-API Webhook] Global error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 even on error as requested to avoid Z-API retries/blocking
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});