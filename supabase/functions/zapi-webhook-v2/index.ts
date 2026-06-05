import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "../_shared/whatsapp-settings.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, message: "Webhook V2 active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[WebhookV2] CALLBACK_STAGE_0: JSON Parse error");
    return new Response("Invalid JSON", { status: 400 });
  }

  // STAGE 1: Webhook recebido
  console.log("--- INCOMING Z-API WEBHOOK (V2) ---");
  console.log("STAGE 1: Payload total:", JSON.stringify(body, null, 2));

  // 1. EXTRAIR DADOS BÁSICOS
  // Z-API pode enviar campos em lugares diferentes dependendo da versão
  const phone = body.phone || body.from || (body.body && body.body.phone);
  const type = body.type;
  const fromMe = body.fromMe;
  
  // Capturar texto de várias formas possíveis (texto simples, botão, resposta de lista)
  const incomingText = 
    body.text?.message || 
    body.message || 
    body.body?.text?.message ||
    body.body?.message ||
    body.body || 
    body.buttonsResponseMessage?.buttonText || 
    body.buttonsResponseMessage?.message || 
    body.listResponseMessage?.title ||
    "";

  const messageId = body.messageId || body.id || (body.body && (body.body.messageId || body.body.id));
  
  // ID do botão clicado
  const buttonId = 
    body.buttonsResponseMessage?.buttonId || 
    body.listResponseMessage?.listRowId ||
    (body.body?.buttonsResponseMessage?.buttonId);

  // ID da mensagem à qual esta resposta se refere (crucial para vincular ao agendamento correto)
  const referenceMessageId = 
    body.referenceMessageId || 
    body.body?.referenceMessageId || 
    (body.message && body.message.context && body.message.context.stanzaId); 

  // STAGE 2: Payload validado
  console.log(`STAGE 2: Payload validado. Phone: ${phone}, Type: ${type}, ButtonId: ${buttonId}, Ref: ${referenceMessageId}`);

  const normalizedText = incomingText.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // SALVAR LOG DE ENTRADA
  const { data: webhookLog, error: logErr } = await supabase.from("automation_webhook_logs").insert({
    raw_payload: body,
    type,
    fromme: fromMe,
    phone_raw: phone,
    phone_normalized: phone,
    messageid: messageId,
    incoming_text: incomingText,
    normalized_text: normalizedText,
    buttonid: buttonId,
    referencemessageid: referenceMessageId,
    created_at: new Date().toISOString()
  }).select().single();

  if (fromMe) {
    console.log("[WebhookV2] Ignored fromMe message");
    return new Response(JSON.stringify({ ok: true, status: "ignored_from_me" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // STAGE 3: Localizar contexto (Dispatch / Conversation)
  console.log(`STAGE 3: Searching dispatch for reference: ${referenceMessageId || 'none'} or phone: ${phone}`);
  
  let dispatchUpdateQuery = supabase.from("automation_v2_dispatches").update({
    callback_received: true,
    callback_received_at: new Date().toISOString(),
    callback_button_id: buttonId || normalizedText,
    callback_payload: body
  });

  if (referenceMessageId) {
    dispatchUpdateQuery = dispatchUpdateQuery.eq("message_id", referenceMessageId);
  } else {
    // Fallback by phone - last 12 hours (increased from 2h to be more robust)
    const twelveHoursAgo = new Date(Date.now() - (12 * 60 * 60 * 1000)).toISOString();
    dispatchUpdateQuery = dispatchUpdateQuery
      .eq("phone", phone)
      .gte("created_at", twelveHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: updatedDispatches, error: dispatchUpdateErr } = await dispatchUpdateQuery.select();
  const updatedDispatch = updatedDispatches?.[0];
  
  if (dispatchUpdateErr) {
    console.error("STAGE 3 FAIL: Error updating dispatch:", dispatchUpdateErr);
  } else if (updatedDispatch) {
    console.log("STAGE 3 SUCCESS: Dispatch localizado e atualizado", updatedDispatch.id);
  }

  // BUSCAR CONVERSA ATIVA
  const { data: conversations } = await supabase
    .from("automation_conversations")
    .select("*")
    .eq("phone_normalized", phone)
    .in("status", ["active", "awaiting_response"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const selectedConversation = conversations?.[0];
  
  if (selectedConversation) {
    console.log("STAGE 3 SUCCESS: Conversa localizada", selectedConversation.id);
  }

  // Atualizar log com o contexto encontrado
  await supabase.from("automation_webhook_logs").update({
    conversation_selected_id: selectedConversation?.id,
    conversation_found: !!selectedConversation,
    dispatch_updated: !!updatedDispatches?.length,
    appointment_id: selectedConversation?.appointment_id || updatedDispatch?.appointment_id
  }).eq("id", webhookLog.id);

  if (!selectedConversation && !updatedDispatch) {
    console.warn(`STAGE 3 FAIL: No active context found for ${phone}. Searching for last appointment fallback.`);
    
    // Fallback: Buscar último agendamento do cliente por telefone
    const { data: customerData } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
    const { data: lastAppt } = customerData ? await supabase
      .from("appointments")
      .select("id, tenant_id")
      .eq("customer_id", customerData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() : { data: null };

    if (lastAppt) {
      console.log("STAGE 3 FALLBACK: Using last appointment", lastAppt.id);
      await supabase.from("automation_webhook_logs").update({
        appointment_id: lastAppt.id,
        error_message: "Contexto não encontrado, usando fallback do último agendamento"
      }).eq("id", webhookLog.id);
      
      // Prosseguir com este appointmentId
      const appointmentId = lastAppt.id;
      const tenantId = lastAppt.tenant_id;
    } else {
      return new Response(JSON.stringify({ ok: true, status: "context_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const appointmentId = selectedConversation?.appointment_id || updatedDispatch?.appointment_id || (await supabase.from("automation_webhook_logs").select("appointment_id").eq("id", webhookLog.id).single()).data?.appointment_id;
  const tenantId = selectedConversation?.tenant_id || updatedDispatch?.tenant_id || (await supabase.from("automation_webhook_logs").select("tenant_id").eq("id", webhookLog.id).single()).data?.tenant_id;

  if (!tenantId) {
    console.error("STAGE 3 FAIL: Tenant ID missing");
    return new Response(JSON.stringify({ ok: false, error: "tenant_id_missing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // STAGE 4: Identificar Ação
  const isConfirm = buttonId === "main_confirm" || ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
  const isReschedule = buttonId === "main_reschedule" || ["2", "reagendar"].includes(normalizedText);
  const isCancel = buttonId === "main_cancel" || ["3", "cancelar"].includes(normalizedText);

  let matchedAction = "none";
  if (isConfirm) matchedAction = "confirm";
  else if (isReschedule) matchedAction = "reschedule";
  else if (isCancel) matchedAction = "cancel";

  console.log(`STAGE 4: Action matched: ${matchedAction}`);

  await supabase.from("automation_webhook_logs").update({
    appointment_id_found: appointmentId,
    matched_action: matchedAction,
    tenant_id: tenantId
  }).eq("id", webhookLog.id);

  // STAGE 5: Executar Ação
  if (matchedAction !== "none" && appointmentId) {
    console.log(`STAGE 5: Executing ${matchedAction} for appointment ${appointmentId}`);
    
    // Capturar status anterior para logs
    const { data: initialAppt } = await supabase.from("appointments").select("status").eq("id", appointmentId).single();
    const statusBefore = initialAppt?.status;

    if (matchedAction === "confirm") {
      const { data: appt, error: apptFetchErr } = await supabase
        .from("appointments")
        .select("*, service:services(name), barber:barbers(name)")
        .eq("id", appointmentId)
        .single();
      
      if (apptFetchErr) {
        console.error("STAGE 5 FAIL: Error fetching appointment details:", apptFetchErr);
      }
      
      // 1. Atualizar agendamento
      const { error: apptUpdateErr } = await supabase
        .from("appointments")
        .update({ 
          status: "confirmed", 
          confirmed_at: new Date().toISOString() 
        })
        .eq("id", appointmentId);
      
      if (apptUpdateErr) {
        console.error("STAGE 5 FAIL: Error updating appointment status:", apptUpdateErr);
      }

      // 2. Atualizar conversa/sessão
      if (selectedConversation) {
        await supabase.from("automation_conversations").update({ 
          status: "completed", 
          current_state: "completed", 
          confirmed_at: new Date().toISOString(),
          last_action: "confirm"
        }).eq("id", selectedConversation.id);
      }

      // 3. Atualizar dispatch (Fluxo da Automação)
      if (updatedDispatch) {
        await supabase.from("automation_v2_dispatches").update({
          current_step: "FINALIZADO",
          action_executed: true,
          action_executed_at: new Date().toISOString(),
          finalized: true,
          finalized_at: new Date().toISOString()
        }).eq("id", updatedDispatch.id);
      }

      // 4. Registrar logs detalhados
      await supabase.from("automation_logs").insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        phone: phone,
        action: "confirm_single_appointment",
        status: "success",
        payload: {
          callback_received: true,
          button_id: buttonId || normalizedText,
          session_id: selectedConversation?.id,
          dispatch_id: updatedDispatch?.id,
          appointment_id: appointmentId,
          appointment_status_before: statusBefore,
          appointment_status_after: "confirmed",
          action_executed: true,
          session_closed: !!selectedConversation,
          flow_finalized: !!updatedDispatch
        }
      });

      // STAGE 6: Resposta ao cliente
      let businessName = "Barbearia";
      const { data: tenant } = await supabase.from("barbershops").select("name").eq("id", tenantId).maybeSingle();
      if (tenant?.name) businessName = tenant.name;

      if (appt) {
        const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
        if (instance) {
          console.log("STAGE 6: Enviando confirmação via WhatsApp");
          await sendMessage(instance, phone, successMsg);
          await supabase.from("automation_webhook_logs").update({ response_sent: true }).eq("id", webhookLog.id);
        }
      }
    } else {
      // REAGENDAR / CANCELAR
      if (selectedConversation) {
        await supabase.from("automation_conversations").update({ 
          current_state: matchedAction === "reschedule" ? "AWAITING_RESCHEDULE" : "AWAITING_CANCEL",
          last_action: matchedAction
        }).eq("id", selectedConversation.id);
      }
      
      if (updatedDispatch) {
        await supabase.from("automation_v2_dispatches").update({
          current_step: matchedAction === "reschedule" ? "REAGENDAMENTO_SOLICITADO" : "CANCELAMENTO_SOLICITADO",
          action_executed: true,
          action_executed_at: new Date().toISOString()
        }).eq("id", updatedDispatch.id);
      }
      
      // Registrar log para outras ações
      await supabase.from("automation_logs").insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        phone: phone,
        action: matchedAction === "reschedule" ? "request_reschedule" : "request_cancel",
        status: "success",
        payload: {
          callback_received: true,
          button_id: buttonId || normalizedText,
          appointment_status_before: statusBefore
        }
      });
    }
  } else {
    console.warn("STAGE 5 FAIL: No action matched or missing appointment ID");
    await supabase.from("automation_webhook_logs").update({
      error_message: "No action matched or missing appointment ID"
    }).eq("id", webhookLog.id);
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});