import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { handleAutomationWhatsappResponse } from "../_shared/automation-engine.ts";
import { normalizePhone } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractSelectedOption(payload: any) {
  let text = "";
  let id = "";

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

async function handleIncomingWhatsappWebhook(supabase: any, body: any, headers: any, source: string, integrationIdFromUrl?: string) {
  const { type, phone, instanceId } = body;
  const messageText = String(body.text?.message || body.message?.text || body.text || body.body || "").trim();
  
  // 1. PRIMEIRA LINHA: Salvar no debug (obrigatório)
  const { data: debugLog, error: debugError } = await supabase
    .from("zapi_webhook_debug")
    .insert({
      payload_raw: body,
      headers_raw: headers,
      source: source,
      phone_raw: phone,
      message_text: messageText,
      received_at: new Date().toISOString(),
      processed: false,
      integration_id: integrationIdFromUrl
    })
    .select()
    .single();

  if (debugError) {
    console.error("[Z-API Webhook] Error creating initial debug log:", debugError);
  }

  try {
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

      return { success: true, action: "instance_status_update" };
    }

    if (type === "ReceivedMessage") {
      const normalizedPhone = normalizePhone(phone);
      const option = extractSelectedOption(body);
      
      // If the message is just a number, prioritize it as the option.id
      let identifiedOptionId = option.id;
      if (!identifiedOptionId && /^\d+$/.test(messageText)) {
        identifiedOptionId = messageText;
      }

      // Find the tenant_id
      let tenantId = "";
      
      // Tentar encontrar por instanceId primeiro
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("tenant_id")
        .eq("instance_id", instanceId)
        .maybeSingle();

      if (instance) {
        tenantId = instance.tenant_id;
      } else if (body.tenantId) {
        tenantId = body.tenantId;
      } else if (integrationIdFromUrl && integrationIdFromUrl.length > 20) {
        // Se o integrationIdFromUrl parecer um UUID, pode ser o tenant_id ou id de instancia
        const { data: instByTenant } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id")
          .or(`tenant_id.eq.${integrationIdFromUrl},id.eq.${integrationIdFromUrl}`)
          .maybeSingle();
          
        if (instByTenant) {
          tenantId = instByTenant.tenant_id;
        } else {
          // Fallback: assumir que é o tenant_id se não encontrar instancia
          tenantId = integrationIdFromUrl;
        }
      }

      // Update debug log with extracted info
      if (debugLog) {
        await supabase.from("zapi_webhook_debug")
          .update({
            phone_normalized: normalizedPhone,
            option_id: identifiedOptionId,
            tenant_id: tenantId || null
          })
          .eq("id", debugLog.id);
      }

      if (!tenantId) {
        console.error(`[Z-API Webhook][${source}] Tenant not identified for integrationId: ${integrationIdFromUrl}`);
        if (debugLog) await supabase.from("zapi_webhook_debug").update({ processing_error: "Tenant not identified" }).eq("id", debugLog.id);
        return { success: false, error: "Tenant not identified" };
      }

      console.log(`[Z-API Webhook][${source}] Received from ${phone} (${normalizedPhone}). Message: "${messageText}", Identified Option: ${identifiedOptionId}, Tenant: ${tenantId}`);

      // Find active conversation
      const { data: conversation } = await supabase
        .from("automation_conversations")
        .select("*")
        .eq("phone_normalized", normalizedPhone)
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (debugLog && conversation) {
        await supabase.from("zapi_webhook_debug").update({ matched_conversation_id: conversation.id }).eq("id", debugLog.id);
      }

      if (conversation) {
        console.log(`[Z-API Webhook][${source}] Found conversation: ${conversation.id}, State: ${conversation.current_state}`);

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
          const connection = await getWhatsAppSettings(supabase, tenantId);
          if (connection && result.message_to_send) {
            const sendResult = await sendMessage(connection, normalizedPhone, result.message_to_send);
            
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

        // Log incoming response
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
            source,
            normalized_phone: normalizedPhone,
            current_state: conversation.current_state,
            action_executed: result?.action_executed,
            next_state: result?.next_state
          },
          received_at: new Date().toISOString()
        });

        if (debugLog) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLog.id);
        return { success: true, action: "processed_conversation" };
      } else {
        console.log(`[Z-API Webhook][${source}] No active conversation for ${normalizedPhone}`);
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
        if (debugLog) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLog.id);
        return { success: true, action: "ignored_no_conversation" };
      }
    }

    if (debugLog) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLog.id);
    return { success: true, action: "unhandled_type" };

  } catch (error) {
    console.error(`[Z-API Webhook][${source}] Error:`, error);
    if (debugLog) {
      await supabase.from("zapi_webhook_debug")
        .update({ processing_error: error.message, processed: false })
        .eq("id", debugLog.id);
    }
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const integrationIdFromUrl = pathParts[pathParts.length - 1];

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Resposta para GET (requisito 6)
  if (req.method === "GET") {
    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Z-API webhook active", 
      integration_id: integrationIdFromUrl 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const headers = Object.fromEntries(req.headers.entries());
    
    // Identify source
    let source = "zapi_real";
    if (body.source === "manual_simulation") {
      source = "manual_simulation";
      delete body.source;
    }

    const result = await handleIncomingWhatsappWebhook(supabase, body, headers, source, integrationIdFromUrl);

    return new Response(JSON.stringify(result), {
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
