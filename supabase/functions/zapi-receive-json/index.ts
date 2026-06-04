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

    console.log(`[Webhook] Processing callback for ${phone}. ButtonId: ${buttonId}, Text: ${text}, Ref: ${referenceId}`);

    // Is it a confirmation?
    const isConfirm = buttonId === "main_confirm" || 
                      ["confirmar agendamento", "confirmar", "1", "main_confirm"].includes(text);

    if (isConfirm) {
      console.log(`[Webhook] Confirmation action detected`);
      
      let appointmentId = null;
      let tenantId = null;

      if (referenceId) {
        console.log(`[Webhook] Searching by referenceId: ${referenceId}`);
        const { data: logs } = await supabase
          .from("automation_logs")
          .select("appointment_id, tenant_id, response")
          .order('created_at', { ascending: false });
          
        const log = logs?.find((l: any) => l.response?.messageId === referenceId);
        
        if (log) {
          appointmentId = log.appointment_id;
          tenantId = log.tenant_id;
          console.log(`[Webhook] Found by referenceId: ${appointmentId}`);
        }
      }

      if (!appointmentId) {
        console.log(`[Webhook] Searching by phone: ${phone}`);
        const { data: session } = await supabase
          .from("automation_conversations")
          .select("selected_appointment_id, appointment_ids, tenant_id")
          .eq("phone", phone)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          appointmentId = session.selected_appointment_id || (session.appointment_ids?.[0]);
          tenantId = session.tenant_id;
          console.log(`[Webhook] Found by phone session: ${appointmentId}`);
        }
      }

      if (appointmentId && tenantId) {
        console.log(`[Webhook] Updating appointment ${appointmentId}`);
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
        } else {
          console.log(`[Webhook] Update success. Sending response...`);
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
          
          const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
          if (instance) {
            await sendMessage(instance, phone, successMsg);
            console.log(`[Webhook] Message sent to ${phone}`);
          }

          await supabase.from("automation_conversations")
            .update({ status: "closed", current_state: "completed", updated_at: new Date().toISOString() })
            .eq("phone", phone)
            .eq("status", "active");

          await supabase.from("automation_logs").insert({
            automation_id: appointment.automation_id || (await supabase.from("automations").select("id").limit(1).maybeSingle()).data?.id,
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
        console.warn(`[Webhook] No session found for confirmation click from ${phone}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
