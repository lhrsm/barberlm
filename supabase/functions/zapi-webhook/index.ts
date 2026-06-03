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
  // Ordem de prioridade conforme solicitado pelo usuário
  const possiblePaths = [
    body.buttonsResponseMessage?.buttonId,
    body.buttonsResponseMessage?.selectedButtonId,
    body.buttonsResponseMessage?.message,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.listResponseMessage?.title,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.buttonReply?.id,
    body.buttonReply?.title,
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
  const referenceMessageId = body.referenceMessageId;
  
  console.log(`[Z-API Webhook] Received ${eventType} from ${normalizedPhone}. Ref: ${referenceMessageId}. Tenant: ${tenantId}`);

  // 1. Filter ignored events and sender
  const ignoredEvents = [
    'PresenceChatCallback', 'StatusCallback', 'MessageStatusCallback',
    'DeliveredCallback', 'ReadCallback', 'ConnectedCallback', 'DisconnectedCallback'
  ];
  
  if (ignoredEvents.includes(eventType) || body.fromMe === true || body.isSentByMe === true || body.fromApi === true) {
    console.log(`[Z-API Webhook] Ignoring event ${eventType} (fromMe: ${body.fromMe}, fromApi: ${body.fromApi})`);
    return { success: true, ignored: true };
  }

  // 2. Find active session with priority logic
  let session = null;
  
  // Priority 1: Search by referenceMessageId
  if (referenceMessageId) {
    const { data: refSession } = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider_message_id", referenceMessageId)
      .maybeSingle();
    
    if (refSession) {
      session = refSession;
      console.log(`[Z-API Webhook] Found session by referenceMessageId: ${session.id}`);
    }
  }

  // Priority 2: Search by phone + active status
  if (!session && normalizedPhone) {
    const { data: phoneSession } = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .or(`phone.eq.${normalizedPhone},phone.eq.${fallbackPhone}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (phoneSession) {
      session = phoneSession;
      console.log(`[Z-API Webhook] Found session by phone (active): ${session.id}`);
    }
  }

  // Priority 3: Search last active session for this customer
  if (!session && normalizedPhone) {
    const { data: lastSession } = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`phone.eq.${normalizedPhone},phone.eq.${fallbackPhone}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastSession) {
      session = lastSession;
      console.log(`[Z-API Webhook] Found last session for customer: ${session.id}`);
    }
  }

  // Log incoming after finding session (if any)
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session?.id,
    event_name: `whatsapp.${eventType}`,
    status: "success",
    message: `Webhook recebido de ${normalizedPhone}. Opção: ${selectedOptionRaw}`,
    error_details: JSON.stringify({ 
      body, 
      selectedOptionRaw, 
      referenceMessageId, 
      foundSessionId: session?.id,
      stateBefore: session?.current_step
    })
  });

  if (!session) {
    console.log(`[Z-API Webhook] No session found for ${normalizedPhone}`);
    return { 
      success: true, 
      message: "No session found",
      details: {
        normalizedPhone,
        referenceMessageId,
        selectedOptionRaw
      }
    };
  }

  // 3. Process actions
  const option = selectedOptionRaw.toLowerCase();
  
  if (option === 'main_confirm' || option.includes('confirmar')) {
    return await handleMainConfirm(supabase, session, tenantId);
  } else if (option === 'main_reschedule' || option.includes('reagendar')) {
    return await handleReschedule(supabase, session, tenantId);
  } else if (option === 'main_cancel' || option.includes('cancelar')) {
    return await handleCancel(supabase, session, tenantId);
  }

  return { success: true };
}

async function handleMainConfirm(supabase: any, session: any, tenantId: string) {
  console.log(`[Z-API Webhook] Handling main_confirm for session ${session.id}`);
  
  const stateBefore = session.current_step;
  let responseMessage = "";
  let nextStep = 'completed';
  let actionExecuted = "confirm_appointment";

  // Check for multiple pending appointments for this customer
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, services(name)")
    .eq("customer_id", session.customer_id)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true });

  if (appointments && appointments.length > 1) {
    responseMessage = "Você possui mais de um agendamento pendente. Deseja confirmar todos ou um específico?";
    nextStep = 'awaiting_confirm_scope';
    actionExecuted = "multiple_appointments_found";
    
    // In a real scenario, we would send a button list with options:
    // 1. Confirmar todos
    // 2. Escolher um
    await supabase.functions.invoke('automation-engine', {
      body: { 
        tenantId, 
        action: 'send_message', 
        phone: session.phone, 
        message: responseMessage,
        options: {
          buttons: [
            { id: "confirm_all", label: "Confirmar todos" },
            { id: "choose_one", label: "Escolher um" }
          ]
        }
      }
    });
  } else if (session.appointment_id || (appointments && appointments.length === 1)) {
    const apptId = session.appointment_id || appointments?.[0]?.id;
    
    // 1. Confirm the appointment
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: 'confirmed' })
      .eq("id", apptId);

    if (updateError) {
      console.error(`[Z-API Webhook] Error updating appointment:`, updateError);
      return { success: false, error: "Error updating appointment" };
    }

    responseMessage = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
    nextStep = 'completed';
    
    await supabase.functions.invoke('automation-engine', {
      body: { 
        tenantId, 
        action: 'send_message', 
        phone: session.phone, 
        message: responseMessage 
      }
    });
  } else {
    responseMessage = "Não encontramos nenhum agendamento pendente para confirmar.";
    nextStep = 'completed';
    
    await supabase.functions.invoke('automation-engine', {
      body: { 
        tenantId, 
        action: 'send_message', 
        phone: session.phone, 
        message: responseMessage 
      }
    });
  }

  // Update session
  await supabase.from("conversation_sessions").update({
    current_step: nextStep,
    status: nextStep === 'completed' ? 'closed' : 'active',
    updated_at: new Date().toISOString()
  }).eq("id", session.id);

  // Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session.id,
    event_name: 'whatsapp.action_executed',
    status: "success",
    message: `Ação: ${actionExecuted}`,
    error_details: JSON.stringify({ 
      option: 'main_confirm', 
      state_before: stateBefore,
      state_after: nextStep,
      action_executed: actionExecuted
    })
  });

  return { success: true };
}

async function handleReschedule(supabase: any, session: any, tenantId: string) {
  const responseMessage = "Para reagendar, por favor nos informe a nova data e horário desejado.";
  const nextStep = 'awaiting_reschedule_date';

  await supabase.from("conversation_sessions").update({
    current_step: nextStep,
    updated_at: new Date().toISOString()
  }).eq("id", session.id);

  await supabase.functions.invoke('automation-engine', {
    body: { tenantId, action: 'send_message', phone: session.phone, message: responseMessage }
  });

  return { success: true };
}

async function handleCancel(supabase: any, session: any, tenantId: string) {
  if (session.appointment_id) {
    await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", session.appointment_id);
    const responseMessage = "❌ Seu agendamento foi cancelado conforme solicitado.";
    
    await supabase.from("conversation_sessions").update({
      current_step: 'completed',
      status: 'closed',
      updated_at: new Date().toISOString()
    }).eq("id", session.id);

    await supabase.functions.invoke('automation-engine', {
      body: { tenantId, action: 'send_message', phone: session.phone, message: responseMessage }
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