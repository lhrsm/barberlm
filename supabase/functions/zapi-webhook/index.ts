import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizePhone, removeNinthDigit } from "../_shared/utils.ts";

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
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.listResponseMessage?.title,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.buttonReply?.id,
    body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedButtonId,
    body.buttonsResponseMessage?.selectedDisplayText,
    body.message?.buttonReply?.id,
    body.selectedRowId,
    body.selectedId,
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

async function processZapiWebhook(supabase: any, body: any, tenantId: string) {
  const eventType = body.type || 'unknown';
  const phone = extractPhoneFromZapiPayload(body);
  const normalizedPhone = normalizePhone(phone);
  const fallbackPhone = removeNinthDigit(normalizedPhone);
  const selectedOptionRaw = extractSelectedOption(body);
  
  console.log(`[Z-API Webhook] Received ${eventType} from ${normalizedPhone}. Tenant: ${tenantId}`);

  // 1. Log the incoming webhook
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    event_name: `whatsapp.${eventType}`,
    status: "success",
    message: `Webhook recebido de ${normalizedPhone}`,
    error_details: JSON.stringify({ body, selectedOptionRaw })
  });

  // 2. Filter ignored events
  const ignoredEvents = [
    'PresenceChatCallback', 'StatusCallback', 'MessageStatusCallback',
    'DeliveredCallback', 'ReadCallback', 'ConnectedCallback', 'DisconnectedCallback'
  ];
  if (ignoredEvents.includes(eventType) || body.fromMe === true || body.isSentByMe === true) {
    return { success: true, ignored: true };
  }

  // 3. Find active session
  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .or(`phone.eq.${normalizedPhone},phone.eq.${fallbackPhone}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    console.log(`[Z-API Webhook] No active session found for ${normalizedPhone}`);
    return { success: true, message: "No active session" };
  }

  console.log(`[Z-API Webhook] Found session ${session.id} in state ${session.current_step}`);

  // 4. Advance Session State
  // This logic should eventually move to a shared handler, but let's implement the core here
  const option = selectedOptionRaw.toLowerCase();
  
  if (session.current_step === 'awaiting_main_action') {
    return await handleMainAction(supabase, session, option, tenantId);
  }

  return { success: true };
}

async function handleMainAction(supabase: any, session: any, option: string, tenantId: string) {
  let nextStep = session.current_step;
  let responseMessage = "";
  let actionExecuted = "";

  if (option.includes('confirm') || option === '1') {
    // Confirm Appointment
    if (session.appointment_id) {
      await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", session.appointment_id);
      responseMessage = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
      nextStep = 'closed';
      actionExecuted = "confirm_appointment";
    }
  } else if (option.includes('reagendar') || option === '2') {
    responseMessage = "Para reagendar, por favor nos informe a nova data e horário desejado.";
    nextStep = 'awaiting_reschedule_date';
    actionExecuted = "reschedule_requested";
  } else if (option.includes('cancelar') || option === '3') {
    if (session.appointment_id) {
      await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", session.appointment_id);
      responseMessage = "❌ Seu agendamento foi cancelado conforme solicitado.";
      nextStep = 'closed';
      actionExecuted = "cancel_appointment";
    }
  }

  if (actionExecuted) {
    // Update session
    await supabase.from("conversation_sessions").update({
      current_step: nextStep,
      status: nextStep === 'closed' ? 'closed' : 'active',
      updated_at: new Date().toISOString()
    }).eq("id", session.id);

    // Send response via engine logic (simplified)
    await supabase.functions.invoke('automation-engine', {
      body: { 
        tenantId, 
        action: 'send_message', 
        phone: session.phone, 
        message: responseMessage 
      }
    });

    // Log
    await supabase.from("automation_logs").insert({
      tenant_id: tenantId,
      session_id: session.id,
      event_name: 'whatsapp.response_received',
      step: session.current_step,
      status: "success",
      message: `Ação executada: ${actionExecuted}`,
      error_details: JSON.stringify({ option, nextStep })
    });
  }

  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantId = url.pathname.split("/").pop();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const result = await processZapiWebhook(supabase, body, tenantId!);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Z-API Webhook] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
