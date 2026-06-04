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
  const phone = body.phone || body.from;
  const messageId = body.messageId || body.id;
  const referenceId = body.referenceMessageId;
  const buttonId = body.buttonsResponseMessage?.buttonId;
  const buttonText = body.buttonsResponseMessage?.selectedButtonId || body.text?.message || "";
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
    messageId,
    referenceMessageId: referenceId,
    buttonId,
    buttonText
  }).select().single();

  if (webhookLogError) console.error("[Webhook] Error saving webhook log:", webhookLogError);

  // PROCESS CALLBACK
  if (type === "ReceivedCallback" && !fromMe) {
    console.log(`[Webhook] Processing callback for ${phone}. ButtonId: ${buttonId}, Text: ${buttonText}`);

    // REGISTRAR CLIQUE (Geral)
    if (buttonId || buttonText) {
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
          button_text: body.buttonsResponseMessage?.selectedButtonId || buttonText,
          referenceMessageId: referenceId,
          webhook_received: true,
          phone,
          message_id: messageId
        }
      });
    }

    // NORMALIZAÇÃO DO TEXTO PARA TRATAMENTO SEM BOTÕES
    const normalizedText = buttonText.toLowerCase().trim();
    const isConfirm = buttonId === "main_confirm" || 
                      ["1", "confirmar", "confirmar agendamento"].includes(normalizedText);

    if (isConfirm) {
      console.log(`[Webhook] Confirmation action detected`);
      
      let appointmentId = null;
      let tenantId = null;
      let sessionId = null;
      let automationId = null;
      let foundLog = null;
      let fallbackUsed = false;

      // 1. Search strictly by referenceId (matching provider_message_id)
      if (referenceId) {
        console.log(`[Webhook] Searching strictly by referenceId: ${referenceId}`);
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
          sessionId = log.conversation_id;
          console.log(`[Webhook] Found by provider_message_id: ${appointmentId}`);
        }
      }

      // 2. Fallback search (Phone + Timeframe + Status aguardando_resposta)
      // Agora priorizamos o status "aguardando_resposta" conforme pedido para fluxo de texto
      if (!appointmentId && phone) {
        console.log(`[Webhook] Fallback search by phone: ${phone}`);
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
          sessionId = fallbackLog.conversation_id;
          fallbackUsed = true;
          console.log(`[Webhook] Found by fallback phone search: ${appointmentId}`);
        }
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

      const appointment = foundLog?.appointment;
      const statusBefore = appointment?.status;

      // IDEMPOTENCY CHECK
      if (statusBefore === "confirmed") {
        console.log(`[Webhook] Appointment ${appointmentId} already confirmed.`);
        
        await supabase.from("automation_logs").insert({
          automation_id: automationId,
          tenant_id: tenantId,
          appointment_id: appointmentId,
          phone,
          status: "info",
          action: "duplicate_confirmation_blocked",
          payload: { 
            clicked_referenceMessageId: referenceId,
            appointment_id_found: appointmentId,
            duplicate_blocked: true,
            status_before: statusBefore
          }
        });

        return new Response(JSON.stringify({ ok: true, status: "already_confirmed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // UPDATE APPOINTMENT
      console.log(`[Webhook] Updating appointment ${appointmentId} to confirmed`);
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmation_response_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error(`[Webhook] Update error:`, updateError);
      } else {
        // Resolve names for success message
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

        const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appointment?.start_time)}\n⏰ ${formatBrazilTime(appointment?.start_time)}\n💈 ${profName}\n✂️ ${appointment?.service?.name || "Serviço"}`;
        
        let zapiResponse = null;
        const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
        if (instance) {
          zapiResponse = await sendMessage(instance, phone, successMsg);
        }

        // Close session
        if (sessionId) {
          await supabase.from("automation_conversations")
            .update({ status: "closed", current_state: "completed", updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        }

        // Update original log with callback info
        if (foundLog) {
            await supabase.from("automation_logs").update({
                callback_received: true,
                callback_received_at: new Date().toISOString(),
                button_id: buttonId || (normalizedText === '1' ? "main_confirm" : normalizedText),
                final_status: "confirmed",
                status: "success" // Atualiza de aguardando_resposta para success após o fluxo
            }).eq("id", foundLog.id);
        }

        // 5. Etapa Resposta (Log de Auditoria)
        await supabase.from("automation_logs").insert({
          automation_id: automationId,
          tenant_id: tenantId,
          appointment_id: appointmentId,
          status: "info",
          action: "resposta_recebida",
          payload: { 
            text: buttonText, 
            normalized: normalizedText, 
            match: isConfirm ? "confirm" : "unknown" 
          }
        });

        // 6. Etapa Ação (Log de Auditoria)
        await supabase.from("automation_logs").insert({
          automation_id: automationId,
          tenant_id: tenantId,
          appointment_id: appointmentId,
          status: "info",
          action: "acao_executada",
          payload: { 
            action: "confirm_appointment", 
            result: "success",
            appointment_id: appointmentId
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
          state_after: "confirmed",
          idempotency_key: messageId,
          zapi_response: zapiResponse,
          payload: { 
            clicked_referenceMessageId: referenceId,
            provider_message_id_found: !!foundLog?.provider_message_id,
            appointment_id_found: appointmentId,
            appointment_date: appointment ? formatBrazilDate(appointment.start_time) : null,
            appointment_time: appointment ? formatBrazilTime(appointment.start_time) : null,
            status_before: statusBefore,
            status_after: "confirmed",
            duplicate_blocked: false,
            success_message_sent: !!zapiResponse,
            webhook_received: true, 
            button_id: buttonId || (normalizedText === '1' ? "main_confirm" : normalizedText),
            session_closed: true,
            fallback_used,
            input_text: buttonText,
            incoming_text: buttonText,
            normalized_text: normalizedText,
            matched_action: "confirmar",
            appointment_status_before: statusBefore,
            appointment_status_after: "confirmed",
            flow_finished: true
          }
        });

        // Update the webhook log with the found appointment_id
        if (webhookLog) {
            await supabase.from("automation_webhook_logs").update({
                appointment_id: appointmentId,
                tenant_id: tenantId
            }).eq("id", webhookLog.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});