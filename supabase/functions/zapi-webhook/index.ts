import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizePhone, removeNinthDigit, formatAppointmentDateTimeForMessage } from "../_shared/utils.ts";

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
  
  if (option === 'main_confirm' || option === 'confirmar_agendamento' || option.includes('confirmar')) {
    return await handleMainConfirm(supabase, session, tenantId);
  } else if (option === 'confirm_all') {
    return await handleConfirmAll(supabase, session, tenantId);
  } else if (option === 'choose_one' || option === 'confirm_single') {
    return await handleChooseOne(supabase, session, tenantId);
  } else if (option.startsWith('confirm_appt_')) {
    const appointmentId = selectedOptionRaw.replace('confirm_appt_', '');
    return await handleConfirmSpecific(supabase, session, tenantId, appointmentId);
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
    .select("*, services(name), barbers(name)")
    .eq("customer_id", session.customer_id)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true });

  if (appointments && appointments.length > 1) {
    responseMessage = "Você possui mais de um agendamento pendente. Deseja confirmar todos ou um específico?";
    nextStep = 'awaiting_confirm_scope';
    actionExecuted = "multiple_appointments_found";
    
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
    const { data: appointment } = await supabase
      .from("appointments")
      .select("*, services(name), barbers(name)")
      .eq("id", apptId)
      .single();

    // 1. Confirm the appointment using centralized RPC
    const { error: updateError } = await supabase.rpc('update_appointment_status', {
      p_appointment_id: apptId,
      p_new_status: 'confirmed',
      p_changed_by_type: 'customer',
      p_changed_by_id: session.customer_id,
      p_source: 'whatsapp',
      p_metadata: { session_id: session.id }
    });

    if (updateError) {
      console.error(`[Z-API Webhook] Error updating appointment:`, updateError);
      return { success: false, error: "Error updating appointment" };
    }

    // Use centralized formatting for the success message
    const { date: apptDate, time: apptTime } = formatAppointmentDateTimeForMessage(appointment);
    const professionalName = appointment?.barbers?.name || "Profissional";
    const serviceName = appointment?.services?.name || "Serviço";

    responseMessage = `✅ Agendamento confirmado com sucesso!

Estamos te esperando na Barbearia LM.

📅 ${apptDate}
⏰ ${apptTime}
💈 ${professionalName}
✂️ ${serviceName}`;

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

  // Update session - Fixed nextState bug and status/active closing
  const { error: sessionUpdateError } = await supabase.from("conversation_sessions").update({
    current_step: nextStep,
    status: nextStep === 'completed' ? 'closed' : 'active',
    active: nextStep !== 'completed',
    updated_at: new Date().toISOString()
  }).eq("id", session.id);

  if (sessionUpdateError) {
    console.error(`[Z-API Webhook] Error updating session ${session.id}:`, sessionUpdateError);
  }

  // Log mandatory details
  const { error: logError } = await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session.id,
    event_name: 'whatsapp.action_executed',
    status: "success",
    message: `Ação: ${actionExecuted}`,
    error_details: JSON.stringify({ 
      option: 'main_confirm', 
      state_before: stateBefore,
      state_after: nextStep,
      action_executed: actionExecuted,
      phone: session.phone,
      appointment_id: session.appointment_id || (appointments?.[0]?.id),
      message_sent: responseMessage.substring(0, 100) + "..."
    })
  });

  if (logError) {
    console.error(`[Z-API Webhook] Error logging action for session ${session.id}:`, logError);
  }

  return { success: true };
}

async function handleConfirmAll(supabase: any, session: any, tenantId: string) {
  console.log(`[Z-API Webhook] Handling confirm_all for session ${session.id}`);
  
  const groupId = session.appointment_group_id || session.context?.group_id;
  
  if (!groupId) {
    return await handleMainConfirm(supabase, session, tenantId);
  }

  // Confirm all scheduled appointments in the group
  const { data: updatedAppts, error: updateError } = await supabase
    .from("appointments")
    .update({ 
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    })
    .eq("appointment_group_id", groupId)
    .in("status", ['scheduled', 'pending', 'awaiting_payment'])
    .select();

  if (updateError) {
    console.error(`[Z-API Webhook] Error confirming all appointments in group ${groupId}:`, updateError);
    return { success: false, error: "Error updating appointments" };
  }

  const responseMessage = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
  
  await supabase.from("conversation_sessions").update({
    current_step: 'completed',
    status: 'closed',
    active: false,
    updated_at: new Date().toISOString()
  }).eq("id", session.id);

  await supabase.functions.invoke('automation-engine', {
    body: { tenantId, action: 'send_message', phone: session.phone, message: responseMessage }
  });

  // Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session.id,
    event_name: 'whatsapp.action_executed',
    status: "success",
    message: "Ação: confirm_all",
    error_details: JSON.stringify({ 
      group_id: groupId,
      appointments_updated: updatedAppts?.length || 0
    })
  });

  return { success: true };
}

async function handleChooseOne(supabase: any, session: any, tenantId: string) {
  console.log(`[Z-API Webhook] Handling choose_one for session ${session.id}`);
  
  const groupId = session.appointment_group_id || session.context?.group_id;
  
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, services(name), barbers(name)")
    .eq("appointment_group_id", groupId)
    .in("status", ['scheduled', 'pending', 'awaiting_payment'])
    .order("start_time", { ascending: true });

  if (!appointments || appointments.length === 0) {
    const responseMessage = "Não encontramos mais agendamentos pendentes.";
    await supabase.functions.invoke('automation-engine', {
      body: { tenantId, action: 'send_message', phone: session.phone, message: responseMessage }
    });
    return { success: true };
  }

  const buttons = appointments.slice(0, 3).map((appt: any) => {
    const { time } = formatAppointmentDateTimeForMessage(appt);
    return { 
      id: `confirm_appt_${appt.id}`, 
      label: `${time} - ${appt.services?.name}` 
    };
  });

  const responseMessage = "Qual agendamento você deseja confirmar?";
  
  await supabase.from("conversation_sessions").update({
    current_step: 'awaiting_confirm_single_selection',
    updated_at: new Date().toISOString()
  }).eq("id", session.id);

  await supabase.functions.invoke('automation-engine', {
    body: { 
      tenantId, 
      action: 'send_message', 
      phone: session.phone, 
      message: responseMessage,
      options: { buttons }
    }
  });

  return { success: true };
}

async function handleConfirmSpecific(supabase: any, session: any, tenantId: string, appointmentId: string) {
  console.log(`[Z-API Webhook] Handling confirm_specific for appointment ${appointmentId}`);

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, services(name), barbers(name)")
    .eq("id", appointmentId)
    .single();

  if (!appointment) return { success: false, error: "Appointment not found" };

  await supabase.rpc('update_appointment_status', {
    p_appointment_id: appointmentId,
    p_new_status: 'confirmed',
    p_changed_by_type: 'customer',
    p_changed_by_id: session.customer_id,
    p_source: 'whatsapp'
  });

  const { date, time } = formatAppointmentDateTimeForMessage(appointment);
  let responseMessage = `✅ Agendamento das ${time} (${appointment.services?.name}) confirmado!`;

  // Check if there are more pending in the group
  const groupId = session.appointment_group_id || session.context?.group_id;
  const { data: remaining } = await supabase
    .from("appointments")
    .select("id")
    .eq("appointment_group_id", groupId)
    .in("status", ['scheduled', 'pending', 'awaiting_payment'])
    .neq("id", appointmentId);

  if (remaining && remaining.length > 0) {
    responseMessage += `\n\nVocê ainda possui outros agendamentos pendentes. O que deseja fazer com eles?`;
    
    await supabase.from("conversation_sessions").update({
      current_step: 'awaiting_remaining_action_after_confirm',
      updated_at: new Date().toISOString()
    }).eq("id", session.id);

    await supabase.functions.invoke('automation-engine', {
      body: { 
        tenantId, 
        action: 'send_message', 
        phone: session.phone, 
        message: responseMessage,
        options: {
          buttons: [
            { id: "confirm_all", label: "Confirmar restantes" },
            { id: "choose_one", label: "Escolher outro" },
            { id: "main_cancel", label: "Cancelar restantes" }
          ]
        }
      }
    });
  } else {
    responseMessage += `\n\nTodos os seus agendamentos foram confirmados. Te esperamos!`;
    await supabase.from("conversation_sessions").update({
      current_step: 'completed',
      status: 'closed',
      active: false,
      updated_at: new Date().toISOString()
    }).eq("id", session.id);

    await supabase.functions.invoke('automation-engine', {
      body: { tenantId, action: 'send_message', phone: session.phone, message: responseMessage }
    });
  }

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