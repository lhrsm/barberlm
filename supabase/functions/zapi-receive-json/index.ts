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
    return new Response(JSON.stringify({ ok: true, message: "Webhook active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[Webhook] CALLBACK_STAGE_0: JSON Parse error");
    return new Response("Invalid JSON", { status: 400 });
  }

  // CALLBACK_STAGE_1: Webhook recebido
  console.log("CALLBACK_STAGE_1: Webhook recebido da Z-API", JSON.stringify(body, null, 2));

  // 1. EXTRAIR DADOS BÁSICOS
  const phone = body.phone || body.from;
  const type = body.type;
  const fromMe = body.fromMe;
  const incomingText = body.text?.message || body.message || body.body || body.buttonsResponseMessage?.buttonText || "";
  const messageId = body.messageId || body.id;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  const referenceMessageId = body.referenceMessageId; 

  // CALLBACK_STAGE_2: Payload validado
  console.log(`CALLBACK_STAGE_2: Payload validado. Phone: ${phone}, Type: ${type}, ButtonId: ${buttonId}, Ref: ${referenceMessageId}`);

  const normalizedText = incomingText.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // SALVAR LOG
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
    console.log("[Webhook] Ignored fromMe message");
    return new Response(JSON.stringify({ ok: true, status: "ignored_from_me" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 3. VINCULAR AO DISPATCH (HISTÓRICO)
  console.log(`[Webhook] Searching dispatch for reference: ${referenceMessageId || 'none'} or phone: ${phone}`);
  
  let dispatchUpdateQuery = supabase.from("automation_v2_dispatches").update({
    callback_received: true,
    callback_received_at: new Date().toISOString(),
    callback_button_id: buttonId || normalizedText,
    callback_payload: body
  });

  if (referenceMessageId) {
    dispatchUpdateQuery = dispatchUpdateQuery.eq("message_id", referenceMessageId);
  } else {
    // Fallback by phone - only if within last hour to avoid matching old dispatches
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    dispatchUpdateQuery = dispatchUpdateQuery
      .eq("phone", phone)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: updatedDispatches, error: dispatchUpdateErr } = await dispatchUpdateQuery.select();
  const updatedDispatch = updatedDispatches?.[0];
  
  if (dispatchUpdateErr) {
    console.error("[Webhook] Error updating dispatch:", dispatchUpdateErr);
  } else if (updatedDispatch) {
    console.log("CALLBACK_STAGE_3: Session localizada via Dispatch", updatedDispatch.id);
  }

  // 4. BUSCAR CONVERSA ATIVA
  const { data: conversations, error: convError } = await supabase
    .from("automation_conversations")
    .select("*")
    .eq("phone_normalized", phone)
    .in("status", ["active", "awaiting_response"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const selectedConversation = conversations?.[0];
  
  if (selectedConversation) {
    console.log("CALLBACK_STAGE_3: Session localizada via Conversation", selectedConversation.id);
  }

  await supabase.from("automation_webhook_logs").update({
    conversation_selected_id: selectedConversation?.id,
    conversation_found: !!selectedConversation,
    dispatch_updated: !!updatedDispatches?.length,
    appointment_id: selectedConversation?.appointment_id || updatedDispatch?.appointment_id
  }).eq("id", webhookLog.id);

  if (!selectedConversation && !updatedDispatch) {
    console.warn(`[Webhook] CALLBACK_STAGE_3_FAIL: No active context found for ${phone}`);
    return new Response(JSON.stringify({ ok: true, status: "context_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const appointmentId = selectedConversation?.appointment_id || updatedDispatch?.appointment_id;
  const tenantId = selectedConversation?.tenant_id || updatedDispatch?.tenant_id;

  if (!tenantId) {
    console.error("[Webhook] Tenant ID missing from both conversation and dispatch");
    return new Response(JSON.stringify({ ok: false, error: "tenant_id_missing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 5. PROCESSAR AÇÃO
  // Mapeamento de botões e texto (Incluindo fallback 1, 2, 3)
  const isConfirm = buttonId === "main_confirm" || ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
  const isReschedule = buttonId === "main_reschedule" || ["2", "reagendar"].includes(normalizedText);
  const isCancel = buttonId === "main_cancel" || ["3", "cancelar"].includes(normalizedText);

  let matchedAction = "none";
  if (isConfirm) {
    matchedAction = "confirm";
    console.log("CALLBACK_STAGE_4: Action -> CONFIRM");
  } else if (isReschedule) {
    matchedAction = "reschedule";
    console.log("CALLBACK_STAGE_4: Action -> RESCHEDULE");
  } else if (isCancel) {
    matchedAction = "cancel";
    console.log("CALLBACK_STAGE_4: Action -> CANCEL");
  }

  await supabase.from("automation_webhook_logs").update({
    appointment_id_found: appointmentId,
    matched_action: matchedAction,
    tenant_id: tenantId
  }).eq("id", webhookLog.id);

  if (matchedAction !== "none" && appointmentId) {
    console.log(`CALLBACK_STAGE_5: Processando ação ${matchedAction} para o agendamento ${appointmentId}`);
    
    if (matchedAction === "confirm") {
      // Pegar detalhes do agendamento
      const { data: appt } = await supabase.from("appointments").select("*, service:services(name), barber:barbers(name)").eq("id", appointmentId).single();
      
      // Atualizar agendamento
      await supabase.from("appointments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", appointmentId);
      
      // Atualizar conversa se existir
      if (selectedConversation) {
        await supabase.from("automation_conversations").update({ 
          status: "completed", 
          current_state: "completed", 
          confirmed_at: new Date().toISOString() 
        }).eq("id", selectedConversation.id);
      }

      // Atualizar dispatch se existir
      if (updatedDispatch) {
        await supabase.from("automation_v2_dispatches").update({
          current_step: "FINALIZADO"
        }).eq("id", updatedDispatch.id);
      }

      // Enviar mensagem de sucesso
      let businessName = "Barbearia";
      const { data: tenant } = await supabase.from("barbershops").select("name").eq("id", tenantId).maybeSingle();
      if (tenant?.name) businessName = tenant.name;

      const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (instance) {
        console.log("CALLBACK_STAGE_6: Mensagem resposta enviada");
        await sendMessage(instance, phone, successMsg);
        await supabase.from("automation_webhook_logs").update({ response_sent: true }).eq("id", webhookLog.id);
      }
    } else {
      // RESCHEDULE ou CANCEL
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
    }
  } else {
    console.warn(`[Webhook] No action matched or context missing. Phone: ${phone}, Text: ${normalizedText}`);
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

