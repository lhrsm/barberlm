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
    return new Response(JSON.stringify({ ok: true, message: "Webhook V2 active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const phone = body.phone || body.from || (body.body && body.body.phone);
  const type = body.type;
  const fromMe = body.fromMe;
  
  const incomingText = 
    body.text?.message || 
    body.message || 
    body.body?.text?.message ||
    body.body?.message ||
    body.body || 
    body.buttonsResponseMessage?.buttonText || 
    body.buttonsResponseMessage?.message || 
    body.listResponseMessage?.title ||
    "";

  const messageId = body.messageId || body.id || (body.body && (body.body.messageId || body.body.id));
  const buttonId = body.buttonsResponseMessage?.buttonId || body.listResponseMessage?.listRowId || (body.body?.buttonsResponseMessage?.buttonId);
  const referenceMessageId = body.referenceMessageId || body.body?.referenceMessageId || (body.message && body.message.context && body.message.context.stanzaId); 

  const normalizedText = incomingText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const { data: webhookLog } = await supabase.from("automation_webhook_logs").insert({
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

  if (fromMe) return new Response(JSON.stringify({ ok: true, status: "ignored_from_me" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // 1. BUSCAR DISPATCH
  let dispatchUpdateQuery = supabase.from("automation_v2_dispatches").update({
    callback_received: true,
    callback_received_at: new Date().toISOString(),
    callback_button_id: buttonId || normalizedText,
    callback_payload: body
  });

  if (referenceMessageId) {
    dispatchUpdateQuery = dispatchUpdateQuery.or(`message_id.eq.${referenceMessageId},provider_message_id.eq.${referenceMessageId}`);
  } else {
    const twelveHoursAgo = new Date(Date.now() - (12 * 60 * 60 * 1000)).toISOString();
    dispatchUpdateQuery = dispatchUpdateQuery.eq("phone", phone).eq("callback_received", false).gte("created_at", twelveHoursAgo).order("created_at", { ascending: false }).limit(1);
  }

  const { data: updatedDispatches } = await dispatchUpdateQuery.select();
  const updatedDispatch = updatedDispatches?.[0];

  // 2. BUSCAR SESSION V2
  const { data: sessions } = await supabase
    .from("automation_v2_sessions")
    .select("*")
    .eq("phone", phone)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const selectedSession = sessions?.[0];
  
  const appointmentId = updatedDispatch?.appointment_id || selectedSession?.appointment_id;
  const tenantId = updatedDispatch?.tenant_id || selectedSession?.tenant_id;

  if (!appointmentId || !tenantId) {
    return new Response(JSON.stringify({ ok: true, status: "context_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 3. EXECUTAR AÇÃO
  // DEPRECATED: Interactive actions via WhatsApp buttons are no longer supported.
  // Using public management links in the future.
  const matchedAction = "none";

  if (matchedAction === "confirm") {
    const { data: updateData, error: apptUpdateErr } = await supabase
      .from("appointments")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .select();
    
    const updateSuccess = !apptUpdateErr && updateData && updateData.length > 0;

    if (updateSuccess) {
      if (selectedSession) {
        await supabase.from("automation_v2_sessions").update({ status: "completed", current_step: "FINALIZADO" }).eq("id", selectedSession.id);
      }
      if (updatedDispatch) {
        await supabase.from("automation_v2_dispatches").update({ 
          current_step: "FINALIZADO", 
          action_executed: true, 
          action_executed_at: new Date().toISOString(), 
          finalized: true, 
          finalized_at: new Date().toISOString() 
        }).eq("id", updatedDispatch.id);
      }
      
      const { data: appt } = await supabase.from("appointments").select("*, service:services(name), barber:barbers(name)").eq("id", appointmentId).single();
      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (appt && instance) {
        let businessName = "Barbearia";
        const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
        if (tenantData?.name && !['Barbearia', 'Barbershop'].includes(tenantData.name)) businessName = tenantData.name;
        else {
          const { data: profileData } = await supabase.from("profiles").select("business_name").eq("id", tenantId).maybeSingle();
          if (profileData?.business_name) businessName = profileData.business_name;
        }

        const successMsg = `✅ Agendamento confirmado com sucesso!\n\nEstamos te esperando na ${businessName}.\n\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n💈 ${appt.barber?.name || "Profissional"}\n✂️ ${appt.service?.name || "Serviço"}`;
        await sendMessage(instance, phone, successMsg);
      }
    } else {
        await supabase.from("automation_v2_logs").insert({
            tenant_id: tenantId,
            appointment_id: appointmentId,
            level: 'error',
            message: 'Falha ao confirmar agendamento via callback',
            context: { error: apptUpdateErr, rows_updated: updateData?.length || 0, appointment_id: appointmentId, session_id: selectedSession?.id, dispatch_id: updatedDispatch?.id }
        });
    }
  }

  return new Response(JSON.stringify({ ok: true, matchedAction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});