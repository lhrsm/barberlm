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
  const incomingText = body.text?.message || body.message || body.body || "";
  const messageId = body.messageId || body.id;

  // 2. SALVAR LOG OBRIGATÓRIO (PASSO 2 DO DIAGNÓSTICO)
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

  if (type !== "ReceivedCallback" || fromMe) {
    return new Response(JSON.stringify({ ok: true, status: "ignored" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 3. BUSCAR CONVERSA ATIVA (PASSO 3 DO DIAGNÓSTICO)
  console.log(`[Webhook] Searching session for ${phone}`);
  const queryFilters = {
    phone_normalized: phone,
    status: ['active', 'awaiting_response'],
    automation_type: ['appointment_confirmation', 'confirmation'],
    expires_gt: new Date().toISOString()
  };

  const { data: conversations, error: convError } = await supabase
    .from("automation_conversations")
    .select("*")
    .eq("phone_normalized", phone)
    .in("status", ["active", "awaiting_response"])
    .in("automation_type", ["appointment_confirmation", "confirmation"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const conversationsFoundCount = conversations?.length || 0;
  const selectedConversation = conversations?.[0];
  
  // Atualizar log com dados da busca
  await supabase.from("automation_webhook_logs").update({
    query_filters_used: queryFilters,
    conversations_found_count: conversationsFoundCount,
    conversation_selected_id: selectedConversation?.id,
    conversation_found: !!selectedConversation
  }).eq("id", webhookLog.id);

  if (!selectedConversation) {
    console.warn(`[Webhook] Conversation not found for ${phone}`);
    // Opcional: Enviar mensagem de erro se não encontrar a sessão
    return new Response(JSON.stringify({ ok: true, status: "conversation_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const appointmentId = selectedConversation.appointment_id;
  const tenantId = selectedConversation.tenant_id;

  // 4. PROCESSAR AÇÃO (PASSO 4 DO DIAGNÓSTICO)
  const isConfirm = ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
  const isReschedule = ["2", "reagendar"].includes(normalizedText);
  const isCancel = ["3", "cancelar"].includes(normalizedText);

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
    // Pegar detalhes do agendamento para a mensagem
    const { data: appt } = await supabase.from("appointments").select("*, service:services(name), barber:barbers(name)").eq("id", appointmentId).single();
    
    // Atualizar agendamento
    await supabase.from("appointments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", appointmentId);
    
    // Atualizar conversa
    await supabase.from("automation_conversations").update({ status: "completed", current_state: "completed", confirmed_at: new Date().toISOString() }).eq("id", selectedConversation.id);

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
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});