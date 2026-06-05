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
    console.error("[Webhook] JSON Parse error");
    return new Response("Invalid JSON", { status: 400 });
  }

  // 1. EXTRAIR DADOS BÁSICOS
  const phone = body.phone || body.from;
  const type = body.type;
  const fromMe = body.fromMe;
  const incomingText = body.text?.message || body.message || body.body || body.buttonsResponseMessage?.buttonText || "";
  const messageId = body.messageId || body.id;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  const referenceMessageId = body.referenceMessageId; // Importante para vincular ao dispatch

  // 2. SALVAR LOG OBRIGATÓRIO
  const normalizedText = incomingText.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const { data: webhookLog, error: logErr } = await supabase.from("automation_webhook_logs").insert({
    raw_payload: body,
    type,
    fromMe,
    phone_raw: phone,
    phone_normalized: phone,
    messageId,
    incoming_text: incomingText,
    normalized_text: normalizedText,
    created_at: new Date().toISOString()
  }).select().single();

  if (fromMe) {
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
    // Fallback por telefone se não tiver referenceMessageId (mais comum em mensagens de texto)
    dispatchUpdateQuery = dispatchUpdateQuery.eq("phone", phone).order("created_at", { ascending: false }).limit(1);
  }

  const { data: updatedDispatch, error: dispatchUpdateErr } = await dispatchUpdateQuery.select();
  
  if (dispatchUpdateErr) {
    console.error("[Webhook] Error updating dispatch:", dispatchUpdateErr);
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
  
  await supabase.from("automation_webhook_logs").update({
    conversation_selected_id: selectedConversation?.id,
    conversation_found: !!selectedConversation,
    dispatch_updated: !!updatedDispatch?.length
  }).eq("id", webhookLog.id);

  if (!selectedConversation) {
    console.warn(`[Webhook] Conversation not found for ${phone}`);
    return new Response(JSON.stringify({ ok: true, status: "conversation_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const appointmentId = selectedConversation.appointment_id;
  const tenantId = selectedConversation.tenant_id;

  // 5. PROCESSAR AÇÃO
  // Mapeamento de botões e texto
  const isConfirm = buttonId === "main_confirm" || ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
  const isReschedule = buttonId === "main_reschedule" || ["2", "reagendar"].includes(normalizedText);
  const isCancel = buttonId === "main_cancel" || ["3", "cancelar"].includes(normalizedText);

  let matchedAction = "none";
  if (isConfirm) matchedAction = "confirm";
  else if (isReschedule) matchedAction = "reschedule";
  else if (isCancel) matchedAction = "cancel";

  await supabase.from("automation_webhook_logs").update({
    appointment_id_found: appointmentId,
    matched_action: matchedAction,
    tenant_id: tenantId
  }).eq("id", webhookLog.id);

  if (matchedAction === "confirm") {
    // Pegar detalhes do agendamento
    const { data: appt } = await supabase.from("appointments").select("*, service:services(name), barber:barbers(name)").eq("id", appointmentId).single();
    
    // Atualizar agendamento
    await supabase.from("appointments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", appointmentId);
    
    // Atualizar conversa
    await supabase.from("automation_conversations").update({ 
      status: "completed", 
      current_state: "completed", 
      confirmed_at: new Date().toISOString() 
    }).eq("id", selectedConversation.id);

    // Enviar mensagem de sucesso
    let businessName = "Barbearia";
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    if (tenant?.name) businessName = tenant.name;

    const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

    const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (instance) {
      await sendMessage(instance, phone, successMsg);
      await supabase.from("automation_webhook_logs").update({ response_sent: true }).eq("id", webhookLog.id);
    }
  } else if (matchedAction === "reschedule" || matchedAction === "cancel") {
    // Aqui iniciaria o fluxo de reagendamento ou cancelamento
    // Por enquanto, apenas atualizamos o status para mostrar que recebemos
    await supabase.from("automation_conversations").update({ 
      current_state: matchedAction === "reschedule" ? "AWAITING_RESCHEDULE" : "AWAITING_CANCEL",
      last_action: matchedAction
    }).eq("id", selectedConversation.id);
    
    // TODO: Implementar lógica de reagendamento/cancelamento automática
    console.log(`[Webhook] Action ${matchedAction} recognized but complex flow not fully implemented yet.`);
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});