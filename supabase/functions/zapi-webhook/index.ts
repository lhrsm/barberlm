import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizePhone, removeNinthDigit } from "../_shared/utils.ts";
import { handleAutomationWhatsappResponse } from "../_shared/automation-engine.ts";
import { sendMessage, getWhatsAppSettings } from "../_shared/whatsapp-settings.ts";

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
    body.buttonsResponseMessage?.buttonId,
    body.buttonsResponseMessage?.selectedButtonId,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.buttonReply?.id,
    body.selectedRowId,
    body.selectedId,
    body.text?.message,
    body.text,
    body.body,
    body.message?.text,
    body.message?.body
  ];

  for (const val of possiblePaths) {
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Missing tenantId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const eventType = body.type || 'unknown';
    
    // Ignore non-message events and messages from me
    if (body.fromMe === true || body.isSentByMe === true || body.fromApi === true) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = extractPhoneFromZapiPayload(body);
    const normalizedPhone = normalizePhone(phone);
    const fallbackPhone = removeNinthDigit(normalizedPhone);
    const selectedOption = extractSelectedOption(body);
    const referenceMessageId = body.referenceMessageId;

    console.log(`[Z-API Webhook] Incoming message from ${normalizedPhone}. Option: ${selectedOption}. referenceMessageId: ${referenceMessageId}`);
    console.log(`[Z-API Webhook] body.buttonsResponseMessage.buttonId: ${body?.buttonsResponseMessage?.buttonId}`);
    console.log(`[Z-API Webhook] body.buttonsResponseMessage.message: ${body?.buttonsResponseMessage?.message}`);


    // Find active session
    let session = null;
    
    // 1. Try by provider_message_id = referenceMessageId
    if (referenceMessageId) {
      console.log(`[Z-API Webhook] Searching session by referenceMessageId: ${referenceMessageId}`);
      const { data } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider_message_id", referenceMessageId)
        .maybeSingle();
      session = data;
    }

    // 2. Try by phone_normalized = telefone normalizado and status = active
    if (!session && normalizedPhone) {
      console.log(`[Z-API Webhook] Searching active session by phone: ${normalizedPhone}`);
      const { data } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .or(`phone.eq.${normalizedPhone},phone.eq.${fallbackPhone}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = data;
    }

    // 3. Try by appointment_group_id if it exists in context (some webhooks might send it)
    if (!session && body.context?.appointment_group_id) {
       console.log(`[Z-API Webhook] Searching session by group_id: ${body.context.appointment_group_id}`);
       const { data } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("appointment_group_id", body.context.appointment_group_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = data;
    }

    if (!session) {
      console.log(`[Z-API Webhook] No active session found for ${normalizedPhone}. Reference: ${referenceMessageId}`);
      
      // Mandatory log for session not found
      await supabase.from("automation_logs").insert({
        tenant_id: tenantId,
        event_name: 'whatsapp.session_not_found',
        status: "error",
        message: `Sessão não encontrada para o telefone ${normalizedPhone}`,
        error_details: JSON.stringify({ 
          referenceMessageId, 
          phone: normalizedPhone,
          body: JSON.stringify(body).substring(0, 500),
          error: "session_not_found"
        })
      });

      return new Response(JSON.stringify({ success: true, message: "No active session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process using Engine
    const stateBefore = session.current_step;
    console.log(`[Z-API Webhook] Processing session ${session.id} in state ${stateBefore}`);
    
    const engineResult = await handleAutomationWhatsappResponse(supabase, {
      tenant_id: tenantId,
      phone: normalizedPhone,
      customer_id: session.customer_id,
      current_state: stateBefore,
      option_id: selectedOption,
      conversation_id: session.id
    });

    let zapiResponse = null;

    if (engineResult && engineResult.message_to_send) {
      const connection = await getWhatsAppSettings(supabase, tenantId);
      if (connection) {
        const sendResult = await sendMessage(connection, normalizedPhone, engineResult.message_to_send, {
          buttons: engineResult.buttons,
          list: engineResult.list
        });

        zapiResponse = sendResult.response;

        if (sendResult.success && sendResult.response?.messageId) {
          await supabase.from("conversation_sessions")
            .update({ provider_message_id: sendResult.response.messageId })
            .eq("id", session.id);
        }
      }
    }

    // Log the interaction with mandatory fields
    await supabase.from("automation_logs").insert({
      tenant_id: tenantId,
      session_id: session.id,
      appointment_group_id: session.appointment_group_id,
      event_name: 'whatsapp.webhook_processed',
      status: "success",
      message: `Opção ${selectedOption} processada. Novo estado: ${engineResult?.next_state}`,
      error_details: JSON.stringify({ 
        raw_payload: body,
        buttonId: body?.buttonsResponseMessage?.buttonId,
        buttonMessage: body?.buttonsResponseMessage?.message,
        referenceMessageId: body?.referenceMessageId,
        phone_raw: phone,
        phone_normalized: normalizedPhone,
        selectedOption: selectedOption, 
        selectedOptionNormalized: engineResult?.selected_option_normalized,
        session_found: !!session,
        session_id: session.id,
        provider_message_id: session.provider_message_id,
        current_step_before: stateBefore, 
        appointments_count: engineResult?.appointments_count || (appointments?.length || 0),
        appointment_group_id: session.appointment_group_id,
        action: engineResult?.action_executed,
        current_step_after: engineResult?.next_state,
        zapi_response: zapiResponse,
        loop_blocked: true
      })
    });


    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Z-API Webhook] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
