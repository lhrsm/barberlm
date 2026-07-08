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
    // 5.1 Tentar resolver a interação configurada (Phase 2 - novo modelo)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let interaction: any = null;
    if (buttonId && uuidRegex.test(buttonId)) {
      const { data: it } = await supabase
        .from("automation_interactions")
        .select("id, action_type, success_message, action_payload, button_title, tenant_id")
        .eq("id", buttonId)
        .maybeSingle();
      interaction = it;
    }

    // 5.2 Fallback legado (botões antigos por texto/id fixo)
    const isConfirm = buttonId === "main_confirm" || ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);
    const isReschedule = buttonId === "main_reschedule" || ["2", "reagendar"].includes(normalizedText);
    const isCancel = buttonId === "main_cancel" || ["3", "cancelar"].includes(normalizedText);

    let matchedAction = "none";
    if (interaction?.action_type) {
      // Mapear action_type da interação -> ação executável
      const map: Record<string, string> = {
        confirm_appointment: "confirm",
        cancel_appointment: "cancel",
        reschedule_appointment: "reschedule",
        open_portal: "send_link",
        open_public_page: "send_link",
        review: "send_link",
        renew_subscription: "send_link",
        change_plan: "send_link",
        buy_product: "send_link",
        talk_to_shop: "send_link",
        webhook: "webhook",
        edge_function: "edge_function",
        api_call: "webhook",
        start_flow: "start_flow",
      };
      matchedAction = map[interaction.action_type] || "custom";
    } else if (isConfirm) matchedAction = "confirm";
    else if (isReschedule) matchedAction = "reschedule";
    else if (isCancel) matchedAction = "cancel";

    await supabase.from("automation_webhook_logs").update({
      matched_action: matchedAction,
      tenant_id: tenantId
    }).eq("id", webhookLog.id);

    // 5.3 Registrar evento de clique
    if (interaction) {
      await supabase.from("automation_interaction_events").insert({
        tenant_id: interaction.tenant_id || tenantId,
        interaction_id: interaction.id,
        dispatch_id: updatedDispatch?.id || null,
        appointment_id: appointmentId,
        customer_phone: phone,
        event_type: "clicked",
        response_text: incomingText || interaction.button_title,
        source: "zapi_webhook",
        metadata: { buttonId, action_type: interaction.action_type }
      });
    }

    if (matchedAction !== "none" && (appointmentId || matchedAction === "webhook" || matchedAction === "edge_function")) {
      console.log(`ACTION_EXECUTED: ${matchedAction} para o agendamento ${appointmentId}`);
      await supabase.from("automation_webhook_logs").update({
        last_processing_step: 'ACTION_EXECUTED'
      }).eq("id", webhookLog.id);

      // Buscar detalhes do agendamento (usados por várias ações)
      let appt: any = null;
      if (appointmentId) {
        const { data } = await supabase
          .from("appointments")
          .select("*, service:services(name), barber:barbers(name)")
          .eq("id", appointmentId)
          .single();
        appt = data;
      }

      // Buscar instância WhatsApp
      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();

      // Nome da barbearia
      let businessName = "Barbearia";
      const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
      if (profile?.business_name) businessName = profile.business_name;
      else {
        const { data: tenant } = await supabase.from("barbershops").select("name").eq("id", tenantId).maybeSingle();
        if (tenant?.name) businessName = tenant.name;
      }

      // Link de gestão
      const mgmtToken = appt?.management_token || appt?.id;
      const managementLink = mgmtToken ? `https://barbex.shop/agendamento/${mgmtToken}?tenant=${tenantId}` : "";

      // Helper para renderizar success_message
      const renderMsg = (tpl: string) => (tpl || "")
        .replace(/\{customer_name\}/g, appt?.customer_name || "")
        .replace(/\{barbershop_name\}/g, businessName)
        .replace(/\{service_name\}/g, appt?.service?.name || "")
        .replace(/\{professional_name\}/g, appt?.barber?.name || "")
        .replace(/\{management_link\}/g, managementLink);

      let replyMessage = "";

      if (matchedAction === "confirm" && appt) {
        const { error: updateApptErr } = await supabase
          .from("appointments")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .eq("id", appointmentId);
        if (updateApptErr) throw new Error(`Erro ao confirmar: ${updateApptErr.message}`);
        console.log("APPOINTMENT_UPDATED: Status -> confirmed");

        replyMessage = interaction?.success_message
          ? renderMsg(interaction.success_message)
          : `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;

        if (selectedConversation) {
          await supabase.from("automation_conversations").update({
            status: "completed", current_state: "completed", confirmed_at: new Date().toISOString()
          }).eq("id", selectedConversation.id);
        }
        if (updatedDispatch) {
          await supabase.from("automation_v2_dispatches").update({ current_step: "FINALIZADO" }).eq("id", updatedDispatch.id);
        }
      } else if (matchedAction === "cancel" && appt) {
        await supabase.from("appointments")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", appointmentId);
        console.log("APPOINTMENT_UPDATED: Status -> cancelled");

        replyMessage = interaction?.success_message
          ? renderMsg(interaction.success_message)
          : `❌ Seu agendamento foi cancelado.\n\nSe quiser reagendar, é só nos avisar. 💈`;

        if (selectedConversation) {
          await supabase.from("automation_conversations").update({
            status: "completed", current_state: "cancelled", last_action: "cancel"
          }).eq("id", selectedConversation.id);
        }
        if (updatedDispatch) {
          await supabase.from("automation_v2_dispatches").update({ current_step: "CANCELADO" }).eq("id", updatedDispatch.id);
        }
      } else if (matchedAction === "reschedule" && appt) {
        replyMessage = interaction?.success_message
          ? renderMsg(interaction.success_message)
          : `📅 Para reagendar, acesse:\n${managementLink}\n\nEscolha uma nova data e horário disponíveis.`;

        if (selectedConversation) {
          await supabase.from("automation_conversations").update({
            current_state: "AWAITING_RESCHEDULE", last_action: "reschedule"
          }).eq("id", selectedConversation.id);
        }
        if (updatedDispatch) {
          await supabase.from("automation_v2_dispatches").update({ current_step: "REAGENDAMENTO_SOLICITADO" }).eq("id", updatedDispatch.id);
        }
      } else if (matchedAction === "send_link") {
        // Link genérico definido em action_payload.url ou success_message
        const url = interaction?.action_payload?.url || managementLink;
        replyMessage = interaction?.success_message
          ? renderMsg(interaction.success_message).replace(/\{url\}/g, url)
          : (url ? `🔗 Acesse: ${url}` : "");
      } else if (matchedAction === "webhook" || matchedAction === "edge_function") {
        // Disparar webhook/função configurada
        const url = interaction?.action_payload?.url;
        if (url) {
          try {
            await fetch(url, {
              method: interaction?.action_payload?.method || "POST",
              headers: { "Content-Type": "application/json", ...(interaction?.action_payload?.headers || {}) },
              body: JSON.stringify({
                interaction_id: interaction.id,
                appointment_id: appointmentId,
                tenant_id: tenantId,
                customer_phone: phone,
                payload: interaction?.action_payload?.body || {}
              })
            });
          } catch (e: any) {
            console.error("[Webhook Action] Fetch error:", e.message);
          }
        }
        if (interaction?.success_message) replyMessage = renderMsg(interaction.success_message);
      } else if (matchedAction === "start_flow") {
        // Marcar dispatch/conversa para próximo passo do fluxo
        const nextWorkflow = interaction?.action_payload?.workflow_key;
        if (updatedDispatch) {
          await supabase.from("automation_v2_dispatches").update({
            current_step: `FLOW:${nextWorkflow || "next"}`
          }).eq("id", updatedDispatch.id);
        }
        if (interaction?.success_message) replyMessage = renderMsg(interaction.success_message);
      } else if (interaction?.success_message) {
        replyMessage = renderMsg(interaction.success_message);
      }

      // Enviar mensagem de resposta
      if (replyMessage && instance) {
        await sendMessage(instance, phone, replyMessage);
        console.log("SUCCESS_MESSAGE_SENT");
        await supabase.from("automation_webhook_logs").update({
          response_sent: true,
          last_processing_step: 'SUCCESS_MESSAGE_SENT'
        }).eq("id", webhookLog.id);
      }

      // Registrar execução
      if (interaction) {
        await supabase.from("automation_interaction_events").insert({
          tenant_id: interaction.tenant_id || tenantId,
          interaction_id: interaction.id,
          dispatch_id: updatedDispatch?.id || null,
          appointment_id: appointmentId,
          customer_phone: phone,
          event_type: "action_executed",
          source: "zapi_webhook",
          metadata: { matchedAction, reply_sent: !!replyMessage }
        });
      }

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
