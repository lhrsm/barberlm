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

  const url = new URL(req.url);
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
    if (contentType.includes("application/json") && rawBody) {
      body = JSON.parse(rawBody);
    }
  } catch (e) {
    console.error("[Webhook] Parse error:", e);
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

    // Is it a confirmation?
    const isConfirm = buttonId === "main_confirm" || 
                      ["confirmar agendamento", "confirmar", "1", "main_confirm"].includes(text);

    if (isConfirm) {
      console.log(`[Webhook] Confirmation detected for ${phone}`);
      
      // 1. Find Session/Appointment
      let appointmentId = null;
      let tenantId = null;

      // Try by referenceId first (more accurate)
      if (referenceId) {
        const { data: log } = await supabase
          .from("automation_logs")
          .select("appointment_id, tenant_id")
          .eq("response->>messageId", referenceId)
          .maybeSingle();
        
        if (log) {
          appointmentId = log.appointment_id;
          tenantId = log.tenant_id;
        }
      }

      // Fallback to active session by phone
      if (!appointmentId) {
        const { data: session } = await supabase
          .from("automation_conversations")
          .select("selected_appointment_id, appointment_ids, tenant_id, id")
          .eq("phone", phone)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          appointmentId = session.selected_appointment_id || (session.appointment_ids?.[0]);
          tenantId = session.tenant_id;
        }
      }

      if (appointmentId && tenantId) {
        // 2. Update Appointment
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

        if (!updateError) {
          // 3. Resolve Business Name
          let businessName = "Barbearia";
          const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
          if (profile?.business_name) businessName = profile.business_name;

          // Resolve Professional
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

          // 4. Send Success Message
          const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appointment.start_time)}\n⏰ ${formatBrazilTime(appointment.start_time)}\n💈 ${profName}\n✂️ ${appointment.service?.name || "Serviço"}`;
          
          const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
          if (instance) {
            await sendMessage(instance, phone, successMsg);
          }

          // 5. Close Session
          await supabase.from("automation_conversations")
            .update({ status: "closed", current_state: "completed", updated_at: new Date().toISOString() })
            .eq("phone", phone)
            .eq("status", "active");

          // 6. Log success
          await supabase.from("automation_logs").insert({
            tenant_id: tenantId,
            appointment_id: appointmentId,
            phone,
            status: "success",
            action: "confirmed_via_webhook",
            message_sent: successMsg,
            payload: { webhook_type: "button_click", button_id: buttonId || "text_match" }
          });
        }
      } else {
        // Session not found
        console.warn(`[Webhook] Session not found for ${phone}`);
        const { data: instance } = await supabase.from("whatsapp_instances")
          .select("*")
          .filter("tenant_id", "in", (await supabase.from("profiles").select("id").eq("whatsapp_number", body.connectedPhone).maybeSingle()).data?.id || "")
          .maybeSingle();

        if (instance) {
          await sendMessage(instance, phone, "Recebi sua confirmação, mas não encontrei o agendamento vinculado. Por favor, fale com a barbearia.");
        }
        
        await supabase.from("automation_logs").insert({
          phone,
          status: "failed",
          error_message: "session_not_found",
          payload: { webhook_received: true, button_id: buttonId || text }
        });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
