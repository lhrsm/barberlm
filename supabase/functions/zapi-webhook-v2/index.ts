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
  console.log("STAGE 1: Webhook recebido da Z-API", JSON.stringify(body, null, 2));

  // 1. EXTRAIR DADOS BÁSICOS
  const phone = body.phone || body.from;
  const type = body.type;
  const fromMe = body.fromMe;
  const incomingText = body.text?.message || body.message || body.body || body.buttonsResponseMessage?.buttonText || body.buttonsResponseMessage?.message || "";
  const messageId = body.messageId || body.id;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  const referenceMessageId = body.referenceMessageId; 

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
    // Fallback by phone - last 2 hours
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
    dispatchUpdateQuery = dispatchUpdateQuery
      .eq("phone", phone)
      .gte("created_at", twoHoursAgo)
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
    console.warn(`STAGE 3 FAIL: No active context found for ${phone}`);
    return new Response(JSON.stringify({ ok: true, status: "context_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const appointmentId = selectedConversation?.appointment_id || updatedDispatch?.appointment_id;
  const tenantId = selectedConversation?.tenant_id || updatedDispatch?.tenant_id;

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
    
    if (matchedAction === "confirm") {
      const { data: appt } = await supabase.from("appointments").select("*, service:services(name), barber:barbers(name)").eq("id", appointmentId).single();
      
      await supabase.from("appointments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", appointmentId);
      
      if (selectedConversation) {
        await supabase.from("automation_conversations").update({ 
          status: "completed", 
          current_state: "completed", 
          confirmed_at: new Date().toISOString() 
        }).eq("id", selectedConversation.id);
      }

      if (updatedDispatch) {
        await supabase.from("automation_v2_dispatches").update({
          current_step: "FINALIZADO"
        }).eq("id", updatedDispatch.id);
      }

      // STAGE 6: Resposta ao cliente
      let businessName = "Barbearia";
      const { data: tenant } = await supabase.from("barbershops").select("name").eq("id", tenantId).maybeSingle();
      if (tenant?.name) businessName = tenant.name;

      const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (instance) {
        console.log("STAGE 6: Enviando confirmação via WhatsApp");
        await sendMessage(instance, phone, successMsg);
        await supabase.from("automation_webhook_logs").update({ response_sent: true }).eq("id", webhookLog.id);
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
          current_step: matchedAction === "reschedule" ? "REAGENDAMENTO_SOLICITADO" : "CANCELAMENTO_SOLICITADO"
        }).eq("id", updatedDispatch.id);
      }
      
      // Aqui poderíamos enviar uma mensagem pedindo mais detalhes ou confirmando a intenção
    }
  } else {
    console.warn("STAGE 5 FAIL: No action matched or missing appointment ID");
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
