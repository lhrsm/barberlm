import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { handleAutomationWhatsappResponse } from "../_shared/automation-engine.ts";
import { normalizePhone } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    payload.text?.message, // Added this
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
  const phone = body.phone;
  const type = body.type;
  const instanceId = body.instanceId;
  const messageText = String(body.text?.message || body.message?.text || body.text || body.body || "").trim();
  
  // 1. PRIMEIRA LINHA: Salvar no debug (obrigatório) - já foi salvo na função principal serve(), aqui apenas atualizamos se necessário ou usamos o ID
  // Mas para garantir que salve o máximo de info possível o mais cedo, o serve() faz o insert inicial.
  // Vamos buscar o log recém criado pelo serve() se possível, ou criar um novo aqui se não vier ID.
}

serve(async (req) => {
  // CORS handling
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const integrationIdFromUrl = pathParts[pathParts.length - 1];

  // Health check for GET
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let body: any = {};
  let headers: any = {};
  let debugLogId: string | null = null;

  try {
    // 2. Tentar ler o body e headers
    try {
      body = await req.json();
      headers = Object.fromEntries(req.headers.entries());
    } catch (e) {
      console.error("[Z-API Webhook] Error parsing JSON body:", e);
      // Mesmo com erro de parsing, tentamos salvar o que temos
    }

    // Identify source
    let source = "zapi_real";
    if (body.source === "manual_simulation") {
      source = "manual_simulation";
      delete body.source;
    } else if (headers["x-test-post"] === "true" || body.source === "direct_post_test") {
      source = "direct_post_test";
      delete body.source;
    }

    // 3. SALVAR IMEDIATAMENTE (Requisito obrigatório)
    const { data: debugLog, error: debugError } = await supabase
      .from("zapi_webhook_debug")
      .insert({
        payload_raw: body,
        headers_raw: headers,
        source: source,
        phone_raw: body.phone || null,
        message_text: String(body.text?.message || body.message?.text || body.text || body.body || "").trim() || null,
        received_at: new Date().toISOString(),
        processed: false,
        integration_id: integrationIdFromUrl
      })
      .select()
      .single();

    if (debugError) {
      console.error("[Z-API Webhook] Critical Error saving debug log:", debugError);
    } else {
      debugLogId = debugLog.id;
    }

    // Agora processamos o restante
    const { type, phone, instanceId } = body;
    const messageText = String(body.text?.message || body.message?.text || body.text || body.body || "").trim();

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

      return new Response(JSON.stringify({ success: true, action: "instance_status_update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (type === "ReceivedMessage" || type === "ReceivedCallback") {
      const normalizedPhone = normalizePhone(phone);
      const option = extractSelectedOption(body);
      
      let identifiedOptionId = option.id;
      if (!identifiedOptionId && /^\d+$/.test(messageText)) {
        identifiedOptionId = messageText;
      }

      // Find the tenant_id
      let tenantId = "";
      
      // Tentar encontrar por instanceId primeiro
      if (instanceId) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id")
          .eq("instance_id", instanceId)
          .maybeSingle();
        if (instance) tenantId = instance.tenant_id;
      }

      if (!tenantId && body.tenantId) {
        tenantId = body.tenantId;
      } 
      
      if (!tenantId && integrationIdFromUrl && integrationIdFromUrl.length > 20) {
        // Se o integrationIdFromUrl parecer um UUID, pode ser o tenant_id ou id de instancia
        const { data: instByTenant } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id")
          .or(`tenant_id.eq.${integrationIdFromUrl},id.eq.${integrationIdFromUrl}`)
          .maybeSingle();
          
        if (instByTenant) {
          tenantId = instByTenant.tenant_id;
        } else {
          // Fallback: assumir que é o tenant_id
          tenantId = integrationIdFromUrl;
        }
      }

      // Update debug log with extracted info
      if (debugLogId) {
        await supabase.from("zapi_webhook_debug")
          .update({
            phone_normalized: normalizedPhone,
            option_id: identifiedOptionId,
            tenant_id: tenantId || null
          })
          .eq("id", debugLogId);
      }

      if (!tenantId) {
        console.error(`[Z-API Webhook][${source}] Tenant not identified`);
        if (debugLogId) await supabase.from("zapi_webhook_debug").update({ processing_error: "Tenant not identified" }).eq("id", debugLogId);
        
        return new Response(JSON.stringify({ success: false, error: "Tenant not identified" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

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

      if (debugLogId && conversation) {
        await supabase.from("zapi_webhook_debug").update({ matched_conversation_id: conversation.id }).eq("id", debugLogId);
      }

      if (conversation) {
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

        if (debugLogId) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLogId);
        
        return new Response(JSON.stringify({ success: true, action: "processed_conversation", result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Log incoming ignored
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
        
        if (debugLogId) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLogId);
        
        return new Response(JSON.stringify({ success: true, action: "ignored_no_conversation" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    if (debugLogId) await supabase.from("zapi_webhook_debug").update({ processed: true }).eq("id", debugLogId);
    
    return new Response(JSON.stringify({ success: true, action: "unhandled_type" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Z-API Webhook] Error:", error);
    if (debugLogId) {
      await supabase.from("zapi_webhook_debug")
        .update({ processing_error: error.message, processed: false })
        .eq("id", debugLogId);
    }
    
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Retornamos 200 para evitar que a Z-API tente reenviar infinitamente se o erro for lógico
    });
  }
});