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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  const contentType = headers["content-type"] || "";

  if (method === "GET") {
    return new Response(JSON.stringify({ ok: true, message: "Webhook active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: any = null;
  let rawBody = "";

  try {
    const buffer = await req.arrayBuffer();
    rawBody = new TextDecoder().decode(buffer);
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        console.warn("[Webhook] Body is not JSON");
      }
    }
  } catch (e) {
    console.error("[Webhook] Read error:", e);
  }

  if (!body) body = { raw: rawBody };

  // 1. SALVAR TODO WEBHOOK RECEBIDO
  const phone = body.phone || body.from || body.body?.phone;
  const messageId = body.messageId || body.id;
  const referenceId = body.referenceMessageId;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  
  // Extrair texto de múltiplos campos conforme especificado
  const incomingText = body.text?.message || 
                      body.message || 
                      body.body || 
                      body.chatMessage || 
                      body.buttonsResponseMessage?.message || 
                      "";
  const type = body.type;
  const fromMe = body.fromMe;

  // Initial save to debug table (keep for legacy reasons if needed)
  await supabase.from("zapi_webhook_debug").insert({
    method, url: req.url, content_type: contentType, payload_raw: body, source: "zapi_real", processed: false
  });

  // NEW: Save to automation_webhook_logs as requested
  // We try to find tenant_id by phone if not explicitly provided
  let resolvedTenantId = null;
  let resolvedAppointmentId = null;

  if (phone) {
    // Search in instances to find which tenant owns this phone's target (if applicable) or just use latest log
    const { data: latestLog } = await supabase
      .from("automation_logs")
      .select("tenant_id, appointment_id")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestLog) {
      resolvedTenantId = latestLog.tenant_id;
      resolvedAppointmentId = latestLog.appointment_id;
    }
  }

  const { data: webhookLog, error: webhookLogError } = await supabase.from("automation_webhook_logs").insert({
    tenant_id: resolvedTenantId,
    appointment_id: resolvedAppointmentId,
    raw_payload: body,
    type,
    fromMe,
    phone,
    phone_raw: phone,
    messageId,
    referenceMessageId: referenceId,
    buttonId,
    buttonText: incomingText,
    incoming_text: incomingText
  }).select().single();

  if (webhookLogError) console.error("[Webhook] Error saving webhook log:", webhookLogError);

  // PROCESS CALLBACK
  if (type === "ReceivedCallback" && !fromMe) {
    console.log(`[Webhook] Processing callback for ${phone}. Text: ${incomingText}`);

    // REGISTRAR CLIQUE (Geral)
    if (incomingText) {
      // Find appointment context first to enrich the click log if possible
      let enrichedAppointmentId = null;
      let enrichedTenantId = null;

      if (referenceId) {
        const { data: logCtx } = await supabase
          .from("automation_logs")
          .select("appointment_id, tenant_id")
          .eq("provider_message_id", referenceId)
          .maybeSingle();
        
        if (logCtx) {
          enrichedAppointmentId = logCtx.appointment_id;
          enrichedTenantId = logCtx.tenant_id;
        }
      }

      await supabase.from("automation_logs").insert({
        tenant_id: enrichedTenantId,
        appointment_id: enrichedAppointmentId,
        phone,
        status: "info",
        action: "button_clicked",
        payload: {
          event_name: "button_clicked",
          button_id: buttonId,
          button_text: incomingText,
          referenceMessageId: referenceId,
          webhook_received: true,
          phone,
          message_id: messageId
        }
      });
    }

    // NORMALIZAÇÃO DO TEXTO PARA TRATAMENTO SEM BOTÕES
    const normalizedText = incomingText.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .trim();

    const isConfirm = ["1", "confirmar", "confirmar agendamento", "1 confirmo", "confirmo"].includes(normalizedText);
    const isReschedule = ["2", "reagendar", "2 reagendar"].includes(normalizedText);
    const isCancel = ["3", "cancelar", "3 cancelar"].includes(normalizedText);

    if (isConfirm || isReschedule || isCancel) {
      console.log(`[Webhook] Action detected: ${isConfirm ? 'confirm' : isReschedule ? 'reschedule' : 'cancel'}`);
      
      // DEDUPLICAÇÃO DE PROCESSAMENTO POR TEXTO (Janela de 5 segundos)
      const textDedupKey = `dedup:${phone}:${normalizedText}`;
      const { data: recentAction } = await supabase
        .from("automation_logs")
        .select("id")
        .eq("phone", phone)
        .eq("action", "resposta_recebida")
        .eq("status", "info")
        .gt("created_at", new Date(Date.now() - 5000).toISOString())
        .filter("payload->>normalized", "eq", normalizedText)
        .maybeSingle();

      if (recentAction) {
        console.log(`[Webhook] Ignoring duplicate rapid response from ${phone}: ${normalizedText}`);
        return new Response(JSON.stringify({ ok: true, status: "duplicate_ignored" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      let appointmentId = null;
      let tenantId = null;
      let sessionId = null;
      let automationId = null;
      let foundLog = null;
      let fallbackUsed = false;

      // 1. Search in automation_conversations (BEST WAY)
      if (phone) {
        console.log(`[Webhook] Searching active conversation for phone: ${phone}`);
        
        const { data: conversation } = await supabase
          .from("automation_conversations")
          .select("*")
          .or(`phone.eq.${phone},customer_phone.eq.${phone}`)
          .eq("status", "awaiting_response")
          .eq("workflow_key", "appointment_confirmation")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conversation) {
          appointmentId = conversation.appointment_id;
          tenantId = conversation.tenant_id;
          sessionId = conversation.id;
          console.log(`[Webhook] Found session via automation_conversations: ${sessionId}, Appt: ${appointmentId}`);
        }
      }

      // 2. Search strictly by referenceId (matching provider_message_id) - FALLBACK
      if (!appointmentId && referenceId) {
        console.log(`[Webhook] Fallback: Searching strictly by referenceId: ${referenceId}`);
        const { data: log } = await supabase
          .from("automation_logs")
          .select(`
            *,
            appointment:appointments(*, service:services(name))
          `)
          .eq("provider_message_id", referenceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (log) {
          foundLog = log;
          appointmentId = log.appointment_id;
          tenantId = log.tenant_id;
          automationId = log.automation_id;
          sessionId = sessionId || log.conversation_id;
          console.log(`[Webhook] Found by provider_message_id fallback: ${appointmentId}`);
        }
      }

      // 3. Fallback search (Phone + Timeframe + Status aguardando_resposta)
      if (!appointmentId && phone) {
        console.log(`[Webhook] Final fallback search by phone: ${phone}`);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const { data: fallbackLog } = await supabase
          .from("automation_logs")
          .select(`
            *,
            appointment:appointments(*, service:services(name))
          `)
          .eq("phone", phone)
          .eq("callback_received", false)
          .in("status", ["success", "sent", "aguardando_resposta"])
          .gt("created_at", thirtyMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackLog) {
          foundLog = fallbackLog;
          appointmentId = fallbackLog.appointment_id;
          tenantId = fallbackLog.tenant_id;
          automationId = fallbackLog.automation_id;
          sessionId = sessionId || fallbackLog.conversation_id;
          fallbackUsed = true;
          console.log(`[Webhook] Found by final fallback phone search: ${appointmentId}`);
        }
      }

      // 4. Fetch appointment details if found via conversation but not yet via logs
      let appointment = foundLog?.appointment;
      if (appointmentId && !appointment) {
        const { data: apptData } = await supabase
          .from("appointments")
          .select("*, service:services(name)")
          .eq("id", appointmentId)
          .maybeSingle();
        appointment = apptData;
      }

      // IF NOT FOUND
      if (!appointmentId || !tenantId) {
        console.warn(`[Webhook] Link not found for message ${referenceId} from ${phone}`);
        
        await supabase.from("automation_logs").insert({
          tenant_id: null,
          phone,
          status: "not_found",
          action: "confirmed_via_webhook",
          error_message: "Agendamento não encontrado para o referenceMessageId ou telefone fornecido",
          payload: { clicked_referenceMessageId: referenceId, webhook_received: true }
        });

        return new Response(JSON.stringify({ ok: true, status: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const statusBefore = appointment?.status;

      // IDEMPOTENCY CHECK (using messageId from provider)
      const { data: existingProcess } = await supabase
        .from("automation_logs")
        .select("id")
        .eq("idempotency_key", messageId)
        .maybeSingle();

      if (existingProcess) {
        console.log(`[Webhook] Webhook ${messageId} already processed.`);
        return new Response(JSON.stringify({ ok: true, status: "already_processed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // 5. Etapa Resposta (Log de Auditoria)
      await supabase.from("automation_logs").insert({
        automation_id: automationId,
        tenant_id: tenantId,
        appointment_id: appointmentId,
        status: "info",
        action: "resposta_recebida",
        idempotency_key: messageId,
        payload: { 
          text: incomingText, 

          normalized: normalizedText, 
          match: isConfirm ? "confirm" : isReschedule ? "reschedule" : isCancel ? "cancel" : "unknown" 
        }
      });

      // BLOCKED STATE CHECK
      if (statusBefore === "confirmed" && isConfirm) {
        console.log(`[Webhook] Appointment ${appointmentId} already confirmed.`);
        return new Response(JSON.stringify({ ok: true, status: "already_confirmed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // ACTION EXECUTION
      let targetStatus = "";
      let actionLabel = "";
      let successMsg = "";

      if (isConfirm) {
        targetStatus = "confirmed";
        actionLabel = "confirm_appointment";
      } else if (isReschedule) {
        targetStatus = "pending";
        actionLabel = "reschedule_appointment";
      } else if (isCancel) {
        targetStatus = "cancelled";
        actionLabel = "cancel_appointment";
      }

      console.log(`[Webhook] Executing action ${actionLabel} for appointment ${appointmentId}`);

      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: targetStatus,
          updated_at: new Date().toISOString(),
          ...(isConfirm ? { confirmed_at: new Date().toISOString(), confirmation_response_sent_at: new Date().toISOString() } : {})
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error(`[Webhook] Update error:`, updateError);
        return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // Resolve business names for success message
      let businessName = "Barbearia";
      const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
      if (profile?.business_name) businessName = profile.business_name;

      const profId = appointment?.barber_id || appointment?.professional_id;
      let profName = "Profissional";
      if (profId) {
        const { data: barb } = await supabase.from("barbers").select("name").eq("id", profId).maybeSingle();
        if (barb?.name) profName = barb.name;
        else {
          const { data: p } = await supabase.from("profiles").select("full_name").eq("id", profId).maybeSingle();
          if (p?.full_name) profName = p.full_name;
        }
      }

      const dateStr = formatBrazilDate(appointment?.start_time);
      const timeStr = formatBrazilTime(appointment?.start_time);

      if (isConfirm) {
        successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${dateStr}\n⏰ ${timeStr}\n💈 ${profName}\n✂️ ${appointment?.service?.name || "Serviço"}`;
      } else if (isReschedule) {
        successMsg = `Recebemos sua solicitação de reagendamento. Em breve a barbearia dará continuidade.`;
      } else if (isCancel) {
        successMsg = `Recebemos sua solicitação de cancelamento. Em breve a barbearia dará continuidade.`;
      }

      let zapiResponse = null;
      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (instance && successMsg) {
        zapiResponse = await sendMessage(instance, phone, successMsg);
      }

      // Close session (automation_conversations)
      if (sessionId) {
        await supabase.from("automation_conversations")
          .update({ 
            status: "completed", 
            current_state: "completed", 
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq("id", sessionId);
      }

      // Update original log with callback info
      if (foundLog) {
          await supabase.from("automation_logs").update({
              callback_received: true,
              callback_received_at: new Date().toISOString(),
              button_id: buttonId || normalizedText,
              final_status: targetStatus,
              status: "success"
          }).eq("id", foundLog.id);
      }

      // 6. Etapa Ação (Log de Auditoria)
      await supabase.from("automation_logs").insert({
        automation_id: automationId,
        tenant_id: tenantId,
        appointment_id: appointmentId,
        status: "info",
        action: "acao_executada",
        payload: { 
          action: actionLabel, 
          result: "success",
          target_status: targetStatus
        }
      });

      // Detailed Audit Log (7. Finalizado)
      await supabase.from("automation_logs").insert({
        automation_id: automationId,
        tenant_id: tenantId,
        appointment_id: appointmentId,
        conversation_id: sessionId,
        phone,
        status: "success",
        action: "finalizado",
        message_sent: successMsg,
        state_before: statusBefore || "pending",
        state_after: targetStatus,
        idempotency_key: `${messageId}_final`,
        zapi_response: zapiResponse,
        payload: { 
          clicked_referenceMessageId: referenceId,
          appointment_id_found: appointmentId,
          status_before: statusBefore,
          status_after: targetStatus,
          success_message_sent: !!zapiResponse,
          webhook_received: true, 
          button_id: buttonId || normalizedText,
          session_closed: true,
          fallback_used,
          input_text: incomingText,
          normalized_text: normalizedText,
          matched_action: isConfirm ? "confirm" : isReschedule ? "reschedule" : "cancel",
          flow_finished: true
        }
      });

      // Update the webhook log with the found appointment_id and results
      if (webhookLog) {
          await supabase.from("automation_webhook_logs").update({
              appointment_id: appointmentId,
              tenant_id: tenantId,
              processed_at: new Date().toISOString(),
              phone_normalized: phone,
              normalized_text: normalizedText,
              matched_action: isConfirm ? 'confirm' : isReschedule ? 'reschedule' : 'cancel',
              conversation_found: !!sessionId,
              conversation_id: sessionId,
              status_before: statusBefore,
              status_after: targetStatus,
              response_sent: !!zapiResponse,
              error: null
          }).eq("id", webhookLog.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
