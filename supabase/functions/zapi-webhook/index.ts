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

function extractPhoneFromZapiPayload(body: any) {
  const possiblePaths = [
    body.phone,
    body.from,
    body.sender,
    body.senderPhone,
    body.participantPhone,
    body.message?.phone,
    body.message?.from,
    body.message?.sender,
    body.data?.phone,
    body.data?.from,
    body.data?.sender,
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

function extractMessageOrOptionFromZapiPayload(body: any) {
  if (!body) return "";

  const possiblePaths = [
    body.buttonReply?.id,
    body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedButtonId,
    body.buttonsResponseMessage?.selectedDisplayText,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.listResponseMessage?.title,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.message?.listResponseMessage?.title,
    body.selectedRowId,
    body.selectedId,
    body.text?.message,
    body.message?.text,
    body.message?.body,
    body.data?.text,
    body.data?.body,
    body.text,
    body.body
  ];

  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      let text = val.trim().toLowerCase();
      // Remover acentos
      text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Mapeamento de opções
      if (text.includes("confirmar agendamento") || text === "confirmar" || text === "1" || text === "confirm") return "confirm";
      if (text.includes("reagendar") || text === "2" || text === "reschedule") return "reschedule";
      if (text.includes("cancelar") || text === "3" || text === "cancel") return "cancel";
      
      if (text === "confirm_all") return "confirm_all";
      if (text === "confirm_single") return "confirm_single";
      if (text === "reschedule_all") return "reschedule_all";
      if (text === "reschedule_single") return "reschedule_single";
      if (text === "cancel_all") return "cancel_all";
      if (text === "cancel_single") return "cancel_single";
      
      return text;
    }
  }

  return "";
}

function extractSelectedOption(payload: any) {
  const optionId = extractMessageOrOptionFromZapiPayload(payload);
  return {
    id: optionId,
    text: optionId
  };
}

serve(async (req) => {
  // 1. Handle CORS OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const integrationIdFromUrl = pathParts[pathParts.length - 1];
  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  const contentType = headers["content-type"] || "";
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let rawBody = "";
  let body: any = null;
  let debugLogId: string | null = null;

  // 2. Extract Body (Safely)
  try {
    const buffer = await req.arrayBuffer();
    rawBody = new TextDecoder().decode(buffer);
    
    if (contentType.includes("application/json") && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error("[Z-API Webhook] JSON parse error:", e);
      }
    }
  } catch (e) {
    console.error("[Z-API Webhook] Error reading body:", e);
  }

  // Fallback for empty body
  if (!body) body = {};

  // 3. Save RAW payload immediately
  console.log('ZAPI WEBHOOK RECEIVED');
  console.log('RAW PAYLOAD', JSON.stringify(body));
  console.log('BARBER ID', integrationIdFromUrl);

  const phone = extractPhoneFromZapiPayload(body);
  const eventType = body.type || 'unknown';

  try {
    const { data: logData, error: logError } = await supabase
      .from("zapi_webhook_logs")
      .insert({
        barber_id: integrationIdFromUrl.length > 20 ? integrationIdFromUrl : null,
        payload: body,
        phone: phone,
        event_type: eventType,
        processed: false
      })
      .select()
      .single();

    if (logError) {
      console.error("[Z-API Webhook] Error saving to zapi_webhook_logs:", logError);
    } else {
      debugLogId = logData.id;
    }
  } catch (e) {
    console.error("[Z-API Webhook] Critical Error saving webhook log:", e);
  }

  // Also maintain old debug log for compatibility if table exists
  try {
    const { error: debugError } = await supabase
      .from("zapi_webhook_debug")
      .insert({
        method,
        url: req.url,
        content_type: contentType,
        payload_raw: body,
        integration_id: integrationIdFromUrl,
        received_at: new Date().toISOString(),
        processed: false
      });
  } catch (e) {
    // Silent fail for old table
  }

  // 4. Always return 200 OK immediately if it's Z-API (or simulate quick response)
  // We'll proceed with processing in the background (Edge Functions allow this until the connection is closed, but here we return a promise)
  // Actually, in Deno Deploy, once the Response is returned, the execution might be throttled or killed unless using event loop.
  // But for now, we'll keep the logic sequential to ensure processing, but return 200 at the end regardless of errors.

  try {
    // Determine source
    let source = "zapi_real";
    if (body.source === "manual_simulation") {
      source = "manual_simulation";
    } else if (headers["x-test-post"] === "true" || body.source === "direct_post_test" || body.source === "server_test") {
      source = body.source || "direct_post_test";
    }

    if (debugLogId) {
      await supabase.from("zapi_webhook_debug").update({ source }).eq("id", debugLogId);
    }

    // Identify phone and message text for logging
    const phoneRaw = body.phone || null;
    const messageText = String(body.text?.message || body.message?.text || body.text || body.body || "").trim();
    
    if (debugLogId) {
      await supabase.from("zapi_webhook_debug").update({ 
        phone_raw: phoneRaw,
        message_text: messageText || null
      }).eq("id", debugLogId);
    }

    // 5. PROCESS AUTOMATION
    const { type, phone, instanceId } = body;

    // Handle Instance Connection Status
    if (type === "Connected" || type === "Disconnected") {
      if (instanceId) {
        await supabase.from("whatsapp_instances")
          .update({ 
            status: type.toLowerCase(), 
            connected: type === "Connected",
            updated_at: new Date().toISOString()
          })
          .eq("instance_id", instanceId);
      }
      
      if (debugLogId) {
        await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLogId);
      }
    } else if (type === "ReceivedMessage" || type === "ReceivedCallback") {
      const normalizedPhone = normalizePhone(phone || extractPhoneFromZapiPayload(body));
      const optionId = extractMessageOrOptionFromZapiPayload(body);
      
      // Identify the tenant/barber_id
      let tenantId = "";
      if (instanceId) {
        const { data: instance } = await supabase.from("whatsapp_instances").select("tenant_id").eq("instance_id", instanceId).maybeSingle();
        if (instance) tenantId = instance.tenant_id;
      }
      if (!tenantId) tenantId = integrationIdFromUrl;

      if (tenantId && normalizedPhone) {
        // Find active conversation
        const { data: conversation } = await supabase
          .from("automation_conversations")
          .select("*")
          .eq("phone_normalized", normalizedPhone)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conversation) {
          const result = await handleAutomationWhatsappResponse(supabase, {
            tenant_id: tenantId,
            phone: normalizedPhone,
            customer_id: conversation.customer_id,
            automation_type: conversation.automation_type,
            current_state: conversation.current_state,
            option_id: optionId,
            payload: body
          });

          if (result) {
            const connection = await getWhatsAppSettings(supabase, tenantId);
            if (connection && result.message_to_send) {
              const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send);
              
              await supabase.from("automation_logs").insert({
                barber_id: tenantId,
                phone: normalizedPhone,
                event_type: "whatsapp_response",
                state_before: conversation.current_state,
                state_after: result.next_state,
                option_received: optionId,
                message_sent: result.message_to_send,
                zapi_response: sendResult.response,
                status: sendResult.success ? 'success' : 'error',
                error: sendResult.error
              });
            }
          }
          
          if (debugLogId) {
            await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", debugLogId);
          }
        } else {
          console.log("[Z-API Webhook] No active conversation found for phone:", normalizedPhone);
          await supabase.from("automation_logs").insert({
            barber_id: tenantId,
            phone: normalizedPhone,
            event_type: "incoming_ignored",
            option_received: optionId,
            error: "no active conversation found"
          });
          if (debugLogId) {
            await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", debugLogId);
          }
        }
      }
    } else {
      if (debugLogId) {
        await supabase.from("zapi_webhook_logs").update({ processed: true }).eq("id", debugLogId);
      }
    }

  } catch (error) {
    console.error("[Z-API Webhook] Processing Error:", error);
    if (debugLogId) {
      await supabase.from("zapi_webhook_logs")
        .update({ error: error.message, processed: false })
        .eq("id", debugLogId);
    }
  }

  return new Response(JSON.stringify({ 
    ok: true, 
    received: true,
    message: "Webhook processed (or ignored)"
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
