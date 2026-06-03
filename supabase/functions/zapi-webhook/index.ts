import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizePhone, removeNinthDigit, formatBrazilTime } from "../_shared/utils.ts";
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
    body.message?.buttonsResponseMessage?.buttonId,
    body.message?.buttonsResponseMessage?.selectedButtonId,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.buttonReply?.id,
    body.selectedRowId,
    body.selectedId,
    body.text?.message,
    body.text,
    body.body,
    body.message?.text,
    body.message?.body,
    body.message?.contents,
    body.contents
  ];

  for (const val of possiblePaths) {
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }
  return "";
}

async function getAppointmentsForSession(supabase: any, session: any) {
  const groupId = session.appointment_group_id;
  const appointmentId = session.appointment_id;

  if (groupId) {
    const { data } = await supabase
      .from("appointments")
      .select("*, services(name), barbers(name)")
      .eq("appointment_group_id", groupId)
      .order("start_time", { ascending: true });
    return data || [];
  } else if (appointmentId) {
    const { data } = await supabase
      .from("appointments")
      .select("*, services(name), barbers(name)")
      .eq("id", appointmentId);
    return data || [];
  }
  return [];
}


async function updateSessionState(supabase: any, sessionId: string, step: string, active: boolean = true, contextUpdate: any = null) {
  const updateData: any = { 
    current_step: step, 
    active, 
    updated_at: new Date().toISOString() 
  };
  
  if (contextUpdate) {
    const { data: session } = await supabase.from("conversation_sessions").select("context").eq("id", sessionId).single();
    updateData.context = { ...(session?.context || {}), ...contextUpdate };
  }

  await supabase.from("conversation_sessions").update(updateData).eq("id", sessionId);
}

async function logContingency(supabase: any, tenantId: string, session: any, event: string, details: any) {
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session?.id,
    appointment_group_id: session?.appointment_group_id,
    event_name: `whatsapp.contingency_${event}`,
    status: "success",
    message: `Contingência: ${event}`,
    error_details: JSON.stringify({
      ...details,
      contingency: true,
      session_found: !!session,
      timestamp: new Date().toISOString()
    })
  });
}

async function handleContingencyFlow(
  supabase: any,
  body: any,
  tenantId: string,
  session: any,
  selectedOption: string,
  normalizedPhone: string
) {
  const normalizedInput = selectedOption.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const connection = await getWhatsAppSettings(supabase, tenantId);

  // Trigger keywords for initial confirmation
  const isConfirmTrigger = 
    normalizedInput === 'main_confirm' || 
    normalizedInput === 'confirm_appointment' || 
    normalizedInput.includes('confirmar agendamento') || 
    normalizedInput.includes('confirmar');

  console.log(`[Contingency] Normalized input: "${normalizedInput}". IsConfirmTrigger: ${isConfirmTrigger}. State: ${session?.current_step}`);

  // 1. Initial trigger: "Confirmar agendamento"
  if (isConfirmTrigger) {
    if (!session) {
      if (connection) {
        await sendMessage(connection, normalizedPhone, "Recebi sua resposta, mas não encontrei a sessão do agendamento. Fale com a barbearia.");
      }
      await logContingency(supabase, tenantId, null, "error_no_session", { phone: normalizedPhone, input: selectedOption });
      return true;
    }

    const appointments = await getAppointmentsForSession(supabase, session);
    const isMultiple = appointments.length > 1;
    const appointmentIds = appointments.map((a: any) => a.id);

    console.log(`[Contingency] LOG:
      session_id: ${session.id}
      phone: ${normalizedPhone}
      appointment_id: ${session.appointment_id}
      appointment_group_id: ${session.appointment_group_id}
      appointments_loaded: ${JSON.stringify(appointmentIds)}
      appointments_count: ${appointments.length}
      isMultiple: ${isMultiple}
      query_used: ${session.appointment_group_id ? 'group_id' : 'appointment_id'}`);
    
    if (isMultiple) {

      const text = "Como deseja confirmar?\n\n1️⃣ Confirmar todos\n2️⃣ Confirmar um específico";
      if (connection) {
        await sendMessage(connection, normalizedPhone, text);
      }
      
      await updateSessionState(supabase, session.id, 'awaiting_confirm_scope');
      await logContingency(supabase, tenantId, session, "send_scope_menu", {
        current_step_after: 'awaiting_confirm_scope',
        appointments_count: appointments.length,
        isMultiple: true
      });
      return true;
    } else if (appointments.length === 1) {
      // Single appointment confirmation direct in contingency
      const appt = appointments[0];
      await supabase.from("appointments").update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString() 
      }).eq("id", appt.id);

      const time = formatBrazilTime(appt.start_time);
      const barber = appt.barbers?.name || "Profissional";
      const service = appt.services?.name || "Serviço";
      
      const successMessage = `✅ Agendamento confirmado com sucesso!
      
Estamos te esperando na Barbearia LM.

⏰ ${time}
💈 ${barber}
✂️ ${service}`;

      if (connection) {
        await sendMessage(connection, normalizedPhone, successMessage);
      }
      
      await updateSessionState(supabase, session.id, 'completed', false);
      await logContingency(supabase, tenantId, session, "confirm_direct_success", { 
        appointment_id: appt.id,
        isMultiple: false
      });
      return true;
    }

    
    return false;
  }


  // 2. Handle numerical responses if in a contingency state
  if (session) {
    if (session.current_step === 'awaiting_confirm_scope') {
      if (normalizedInput === '1' || normalizedInput.includes('todos')) {
        const appointments = await getAppointmentsForSession(supabase, session);
        const ids = appointments.map((a: any) => a.id);
        
        await supabase.from("appointments").update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString() 
        }).in("id", ids);

        if (connection) {
          await sendMessage(connection, normalizedPhone, "✅ Todos os seus agendamentos foram confirmados com sucesso.");
        }
        await updateSessionState(supabase, session.id, 'completed', false);
        await logContingency(supabase, tenantId, session, "confirm_all_success", { appointments_count: ids.length });
        return true;
      } else if (normalizedInput === '2' || normalizedInput.includes('especifico')) {
        const appointments = await getAppointmentsForSession(supabase, session);
        let listText = "Qual agendamento deseja confirmar?\n\n";
        const mapping: string[] = [];
        
        appointments.forEach((a: any, index: number) => {
          const time = formatBrazilTime(a.start_time);
          const barber = a.barbers?.name || "Profissional";
          const service = a.services?.name || "Serviço";
          listText += `${index + 1}️⃣ ${time} - ${service} com ${barber}\n`;
          mapping.push(a.id);
        });

        if (connection) {
          await sendMessage(connection, normalizedPhone, listText);
        }
        await updateSessionState(supabase, session.id, 'awaiting_confirm_single_selection', true, { appt_mapping: mapping });
        await logContingency(supabase, tenantId, session, "list_specific_sent", { appointments_count: appointments.length });
        return true;
      }
    }

    if (session.current_step === 'awaiting_confirm_single_selection') {
      // Try to extract a number from the input
      const match = normalizedInput.match(/\d+/);
      const index = match ? parseInt(match[0]) - 1 : -1;
      const mapping = session.context?.appt_mapping;
      
      if (index >= 0 && mapping && mapping[index]) {
        const selectedId = mapping[index];
        const { data: appointment } = await supabase.from("appointments").select("*, services(name)").eq("id", selectedId).maybeSingle();
        
        await supabase.from("appointments").update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString() 
        }).eq("id", selectedId);

        const time = appointment ? formatBrazilTime(appointment.start_time) : "";
        if (connection) {
          await sendMessage(connection, normalizedPhone, `✅ Agendamento das ${time} confirmado com sucesso!`);
        }
        
        await updateSessionState(supabase, session.id, 'completed', false);
        await logContingency(supabase, tenantId, session, "confirm_single_success", { 
          selected_index: index + 1,
          appointment_id: selectedId 
        });
        return true;
      }
    }
  }

  return false;
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

    const bodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error("[Z-API Webhook] Error parsing body:", e);
    }
    
    // DEBUG: Log ALL incoming webhooks
    try {
      const phone = extractPhoneFromZapiPayload(body);
      const normalizedPhone = normalizePhone(phone);
      const selectedOption = extractSelectedOption(body);
      
      await supabase.from("zapi_webhook_debug").insert({
        tenant_id: tenantId,
        source: "zapi_real",
        payload_raw: body,
        raw_body: bodyText,
        phone_raw: phone,
        phone_normalized: normalizedPhone,
        option_id: selectedOption,
        method: req.method,
        url: req.url,
        content_type: req.headers.get("content-type"),
        received_at: new Date().toISOString()
      });
    } catch (dbErr) {
      console.error("[Z-API Webhook] Error logging debug:", dbErr);
    }
    
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

    // Find active session FIRST to use in contingency handler
    let session = null;
    
    if (referenceMessageId) {
      const { data } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider_message_id", referenceMessageId)
        .maybeSingle();
      session = data;
    }

    if (!session && normalizedPhone) {
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

    // Call Contingency Handler
    const contingencyHandled = await handleContingencyFlow(supabase, body, tenantId, session, selectedOption, normalizedPhone);
    if (contingencyHandled) {
      return new Response(JSON.stringify({ success: true, contingency: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session) {
      await supabase.from("automation_logs").insert({
        tenant_id: tenantId,
        event_name: 'whatsapp.session_not_found',
        status: "error",
        message: `Sessão não encontrada para o telefone ${normalizedPhone}`,
        error_details: JSON.stringify({ referenceMessageId, phone: normalizedPhone })
      });

      return new Response(JSON.stringify({ success: true, message: "No active session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process using Engine
    const stateBefore = session.current_step;
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

    // Log standard engine processing
    await supabase.from("automation_logs").insert({
      tenant_id: tenantId,
      session_id: session.id,
      appointment_group_id: session.appointment_group_id,
      event_name: 'whatsapp.webhook_processed',
      status: "success",
      message: `Opção ${selectedOption} processada. Novo estado: ${engineResult?.next_state}`,
      error_details: JSON.stringify({ 
        selectedOption,
        stateBefore,
        nextState: engineResult?.next_state,
        zapi_response: zapiResponse
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