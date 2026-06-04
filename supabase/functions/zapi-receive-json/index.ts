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

  // Save debug log
  await supabase.from("zapi_webhook_debug").insert({
    method, url: req.url, content_type: contentType, payload_raw: body, source: "zapi_real", processed: false
  });

  // PROCESS CALLBACK
  if (body.type === "ReceivedCallback" && !body.fromMe) {
    const phone = body.phone;
    const buttonId = body.buttonsResponseMessage?.buttonId;
    const text = body.text?.message?.toLowerCase() || "";
    const referenceId = body.referenceMessageId;
    const messageId = body.messageId; // Unique ID from Z-API for the callback

    console.log(`[Webhook] Processing callback for ${phone}. ButtonId: ${buttonId}, Text: ${text}, Ref: ${referenceId}`);

    // Is it a confirmation?
    const isConfirm = buttonId === "main_confirm" || 
                      ["confirmar agendamento", "confirmar", "1"].includes(text);

    if (isConfirm) {
      console.log(`[Webhook] Confirmation action detected`);
      
      let appointmentId = null;
      let tenantId = null;
      let sessionId = null;
      let automationId = null;

      // 1. Search by referenceId (most reliable)
      if (referenceId) {
        console.log(`[Webhook] Searching by referenceId: ${referenceId}`);
        const { data: log } = await supabase
          .from("automation_logs")
          .select("appointment_id, tenant_id, automation_id, conversation_id")
          .or(`response->>messageId.eq.${referenceId},zapi_response->response->>messageId.eq.${referenceId},zapi_response->>messageId.eq.${referenceId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (log) {
          appointmentId = log.appointment_id;
          tenantId = log.tenant_id;
          automationId = log.automation_id;
          sessionId = log.conversation_id;
          console.log(`[Webhook] Found by referenceId log: ${appointmentId}`);
        }
      }

      // 2. Search by active session if not found
      if (!appointmentId) {
        console.log(`[Webhook] Searching by active session for phone: ${phone}`);
        const { data: session } = await supabase
          .from("automation_conversations")
          .select("id, selected_appointment_id, appointment_ids, tenant_id, automation_id")
          .eq("phone", phone)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          appointmentId = session.selected_appointment_id || (session.appointment_ids?.[0]);
          tenantId = session.tenant_id;
          sessionId = session.id;
          automationId = session.automation_id;
          console.log(`[Webhook] Found by phone session: ${appointmentId}`);
        }
      }

      if (appointmentId && tenantId) {
        // IDEMPOTENCY CHECK: Is it already confirmed?
        const { data: currentAppointment } = await supabase
          .from("appointments")
          .select("status, start_time, barber_id, professional_id")
          .eq("id", appointmentId)
          .single();

        const statusBefore = currentAppointment?.status;

        if (statusBefore === "confirmed") {
          console.log(`[Webhook] Appointment ${appointmentId} already confirmed. Checking if we need to log.`);
          
          // Check if we already logged this specific callback messageId
          if (messageId) {
            const { data: existingLog } = await supabase
              .from("automation_logs")
              .select("id")
              .eq("idempotency_key", messageId)
              .maybeSingle();
              
            if (existingLog) {
              console.log(`[Webhook] Callback ${messageId} already processed. Exiting.`);
              return new Response(JSON.stringify({ ok: true, status: "already_processed" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }
          
          // If already confirmed but first time seeing this callback (or no messageId), just ensure session is closed
          await supabase.from("automation_conversations")
            .update({ status: "closed", current_state: "completed", updated_at: new Date().toISOString() })
            .eq("id", sessionId);
            
          return new Response(JSON.stringify({ ok: true, status: "already_confirmed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        console.log(`[Webhook] Updating appointment ${appointmentId} from ${statusBefore} to confirmed`);
        const { data: appointment, error: updateError } = await supabase
          .from("appointments")
          .update({ 
            status: "confirmed",
            updated_at: new Date().toISOString()
          })
          .eq("id", appointmentId)
          .select(`
            *,
            customer:customers(name),
            service:services(name)
          `)
          .single();

        if (updateError) {
          console.error(`[Webhook] Update error:`, updateError);
          // Log failure
          await supabase.from("automation_logs").insert({
            automation_id: automationId,
            tenant_id: tenantId,
            appointment_id: appointmentId,
            conversation_id: sessionId,
            phone,
            status: "error",
            action: "confirmed_via_webhook",
            error_message: `Update error: ${JSON.stringify(updateError)}`,
            state_before: statusBefore,
            payload: { webhook_received: true, button_id: buttonId || "text", message_id: messageId }
          });
        } else {
          console.log(`[Webhook] Update success. Preparing response message...`);
          let businessName = "Barbearia";
          const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
          if (profile?.business_name) businessName = profile.business_name;

          const profId = appointment.barber_id || appointment.professional_id;
          let profName = "Profissional";
          if (profId) {
            const { data: barb } = await supabase.from("barbers").select("name").eq("id", profId).maybeSingle();
            if (barb?.name) profName = barb.name;
            else {
              const { data: p } = await supabase.from("profiles").select("full_name").eq("id", profId).maybeSingle();
              if (p?.full_name) profName = p.full_name;
            }
          }

          const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appointment.start_time)}\n⏰ ${formatBrazilTime(appointment.start_time)}\n💈 ${profName}\n✂️ ${appointment.service?.name || "Serviço"}`;
          
          let zapiResponse = null;
          const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
          if (instance) {
            zapiResponse = await sendMessage(instance, phone, successMsg);
            console.log(`[Webhook] Message sent to ${phone}`);
          }

          // Close session
          const { error: sessionError } = await supabase.from("automation_conversations")
            .update({ status: "closed", current_state: "completed", updated_at: new Date().toISOString() })
            .eq("id", sessionId);

          // Get a fallback automation_id if not found yet
          if (!automationId) {
            const { data: auto } = await supabase.from("automations").select("id").limit(1).maybeSingle();
            automationId = auto?.id;
          }

          // Detailed Log
          console.log(`[Webhook] Inserting log for appointment ${appointmentId}`);
          const { error: logError } = await supabase.from("automation_logs").insert({
            automation_id: automationId,
            tenant_id: tenantId,
            appointment_id: appointmentId,
            conversation_id: sessionId,
            phone,
            status: "success",
            action: "confirmed_via_webhook",
            message_sent: successMsg,
            state_before: statusBefore || "pending",
            state_after: "confirmed",
            idempotency_key: messageId,
            zapi_response: zapiResponse,
            response: zapiResponse?.response || zapiResponse, // Keep both for safety
            payload: { 

              webhook_received: true, 
              button_id: buttonId || "text_match",
              reference_message_id: referenceId,
              session_found: !!sessionId,
              session_id: sessionId,
              session_closed: !sessionError,
              success_message_sent: !!zapiResponse,
              status_before: statusBefore,
              status_after: "confirmed"
            }
          });

          if (logError) {
            console.error(`[Webhook] Error inserting automation log:`, logError);
          } else {
            console.log(`[Webhook] Automation log inserted successfully`);
          }
        }
      } else {
        console.warn(`[Webhook] No appointment/tenant found for confirmation click from ${phone}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
