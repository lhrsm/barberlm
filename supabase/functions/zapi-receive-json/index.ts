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

  // CALLBACK_RECEIVED
  console.log("CALLBACK_RECEIVED: Webhook recebido da Z-API", JSON.stringify(body, null, 2));

  // 1. EXTRAIR DADOS BÁSICOS
  const phone = body.phone || body.from;
  const type = body.type;
  const fromMe = body.fromMe;
  const incomingText = body.text?.message || body.message || body.body || body.buttonsResponseMessage?.buttonText || body.buttonsResponseMessage?.message || "";
  const messageId = body.messageId || body.id;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  const referenceMessageId = body.referenceMessageId; 

  console.log(`Payload validado. Phone: ${phone}, Type: ${type}, ButtonId: ${buttonId}, Ref: ${referenceMessageId}`);

  const normalizedText = incomingText.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // SALVAR LOG INICIAL
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
    last_processing_step: 'CALLBACK_RECEIVED',
    created_at: new Date().toISOString()
  }).select().single();

  if (!webhookLog) {
    console.error("Erro ao criar log inicial:", logErr);
    return new Response("Internal Error", { status: 500 });
  }

  if (fromMe) {
    console.log("[Webhook] Ignored fromMe message");
    return new Response(JSON.stringify({ ok: true, status: "ignored_from_me" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
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
      console.log("DISPATCH_FOUND: ID", updatedDispatch.id);
    }

    // 4. BUSCAR CONVERSA ATIVA
    const { data: conversations, error: convError } = await supabase
      .from("automation_conversations")
      .select("*")
      .eq("phone_normalized", phone)
      .in("status", ["active", "awaiting_response"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (convError) {
      console.error("Erro ao buscar conversas:", convError);
    }

    const selectedConversation = conversations?.[0];
    console.log(`Conversas encontradas: ${conversations?.length || 0}. Status: ${selectedConversation?.status}, State: ${selectedConversation?.current_state}`);
    
    if (selectedConversation) {
      console.log("CONVERSATION_FOUND: ID", selectedConversation.id);
      await supabase.from("automation_webhook_logs").update({
        conversation_id: selectedConversation.id,
        last_processing_step: 'CONVERSATION_FOUND'
      }).eq("id", webhookLog.id);
    }

    if (!selectedConversation && !updatedDispatch) {
      const errorMsg = `Nenhum contexto ativo encontrado para o telefone ${phone}. Referência: ${referenceMessageId}`;
      console.warn(`[Webhook] CONTEXT_NOT_FOUND: ${errorMsg}`);
      await supabase.from("automation_webhook_logs").update({
        processing_error: errorMsg
      }).eq("id", webhookLog.id);
      return new Response(JSON.stringify({ ok: true, status: "context_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appointmentId = selectedConversation?.appointment_id || updatedDispatch?.appointment_id;
    const tenantId = selectedConversation?.tenant_id || updatedDispatch?.tenant_id;

    if (appointmentId) {
      console.log("APPOINTMENT_FOUND: ID", appointmentId);
      await supabase.from("automation_webhook_logs").update({
        appointment_id: appointmentId,
        last_processing_step: 'APPOINTMENT_FOUND'
      }).eq("id", webhookLog.id);
    } else {
      console.warn("APPOINTMENT_NOT_FOUND para a conversa/dispatch encontrada");
    }

    if (!tenantId) {
      throw new Error("tenant_id_missing: Não foi possível localizar o ID do estabelecimento");
    }

    // 5. PROCESSAR AÇÃO
    const isConfirm = buttonId === "main_confirm" || ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
    const isReschedule = buttonId === "main_reschedule" || ["2", "reagendar"].includes(normalizedText);
    const isCancel = buttonId === "main_cancel" || ["3", "cancelar"].includes(normalizedText);

    let matchedAction = "none";
    if (isConfirm) matchedAction = "confirm";
    else if (isReschedule) matchedAction = "reschedule";
    else if (isCancel) matchedAction = "cancel";

    await supabase.from("automation_webhook_logs").update({
      matched_action: matchedAction,
      tenant_id: tenantId
    }).eq("id", webhookLog.id);

    if (matchedAction !== "none" && appointmentId) {
      console.log(`ACTION_EXECUTED: ${matchedAction} para o agendamento ${appointmentId}`);
      await supabase.from("automation_webhook_logs").update({
        last_processing_step: 'ACTION_EXECUTED'
      }).eq("id", webhookLog.id);
      
      if (matchedAction === "confirm") {
        // Detalhes do agendamento
        const { data: appt, error: apptErr } = await supabase
          .from("appointments")
          .select("*, service:services(name), barber:barbers(name)")
          .eq("id", appointmentId)
          .single();
        
        if (apptErr || !appt) {
          throw new Error(`Erro ao buscar detalhes do agendamento: ${apptErr?.message || 'Não encontrado'}`);
        }

        // APPOINTMENT_UPDATED
        const { error: updateApptErr } = await supabase
          .from("appointments")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .eq("id", appointmentId);
        
        if (updateApptErr) {
          throw new Error(`Erro ao atualizar status do agendamento: ${updateApptErr.message}`);
        }
        console.log("APPOINTMENT_UPDATED: Status -> confirmed");

        // Atualizar conversa
        if (selectedConversation) {
          await supabase.from("automation_conversations").update({ 
            status: "completed", 
            current_state: "completed", 
            confirmed_at: new Date().toISOString() 
          }).eq("id", selectedConversation.id);
          console.log("CONVERSATION_FINISHED: Status -> completed");
        }

        // Atualizar dispatch
        if (updatedDispatch) {
          await supabase.from("automation_v2_dispatches").update({
            current_step: "FINALIZADO"
          }).eq("id", updatedDispatch.id);
        }

        // 6. ENVIAR MENSAGEM DE SUCESSO
        let businessName = "Barbearia";
        const { data: tenant } = await supabase.from("barbershops").select("name").eq("id", tenantId).maybeSingle();
        if (tenant?.name) businessName = tenant.name;

        const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
        if (instance) {
          await sendMessage(instance, phone, successMsg);
          console.log("SUCCESS_MESSAGE_SENT");
          await supabase.from("automation_webhook_logs").update({ 
            response_sent: true,
            last_processing_step: 'SUCCESS_MESSAGE_SENT'
          }).eq("id", webhookLog.id);
        } else {
          console.warn("Instância WhatsApp não encontrada para envio da confirmação");
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

      // FINALIZAÇÃO
      console.log("FLOW_COMPLETED");
      await supabase.from("automation_webhook_logs").update({
        last_processing_step: 'COMPLETED'
      }).eq("id", webhookLog.id);

    } else {
      const warnMsg = `Nenhuma ação correspondente ou contexto faltando. Phone: ${phone}, Text: ${normalizedText}, Action: ${matchedAction}, ApptId: ${appointmentId}`;
      console.warn(`[Webhook] ${warnMsg}`);
      await supabase.from("automation_webhook_logs").update({
        processing_error: warnMsg
      }).eq("id", webhookLog.id);
    }

    return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error('FLOW_ERROR', error);
    await supabase.from("automation_webhook_logs").update({
      processing_error: error.message || String(error)
    }).eq("id", webhookLog.id);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});
