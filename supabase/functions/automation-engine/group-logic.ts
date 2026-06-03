import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { formatBrazilDate, formatBrazilTime, normalizePhone, formatAppointmentDateTimeForMessage } from "../_shared/utils.ts";
import { sendMessage, getWhatsAppSettings } from "../_shared/whatsapp-settings.ts";
import { AUTOMATION_STATES } from "../_shared/automation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export async function handleGroupAppointmentCreated(supabase: any, tenantId: string, groupId: string, payload: any, workflow: any, queueId: string) {
  console.log(`[AutomationEngine] Handling multiple appointments for group ${groupId}`);

  // 1. Fetch all appointments in the group
  const { data: groupItems, error: groupError } = await supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name), profiles:tenant_id(business_name)")
    .eq("appointment_group_id", groupId)
    .order("start_time", { ascending: true });

  if (groupError || !groupItems || groupItems.length === 0) {
    throw new Error(`No appointments found for group ${groupId}`);
  }

  const customer = groupItems[0].customers;
  const normalizedPhoneValue = normalizePhone(customer.phone);

  // 2. Anti-loop Check for the group
  // Check if ANY appointment in the group already has confirmation sent
  const alreadySent = groupItems.some(item => item.confirmation_sent === true || item.confirmation_sent_at);
  
  // Also check if there's already an active conversation for this group to prevent duplication
  const { data: existingGroupConv } = await supabase
    .from("conversation_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("appointment_group_id", groupId)
    .maybeSingle();

  if (alreadySent || existingGroupConv) {
    console.log(`[AutomationEngine] BLOCKED: Initial message already sent or session exists for group ${groupId}`);
    return { success: true, message: "Group message already handled" };
  }

  // 3. Deactivate previous active conversations
  await supabase.from("conversation_sessions")
    .update({ status: 'closed', active: false })
    .eq("tenant_id", tenantId)
    .eq("phone", normalizedPhoneValue)
    .eq("status", "active");

  // 4. Create Group Session
  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      phone: normalizedPhoneValue,
      channel: 'whatsapp',
      status: 'active',
      current_step: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
      context: { 
        group_id: groupId,
        appointment_ids: groupItems.map(i => i.id),
        customer_name: customer.name,
        is_group: true
      }
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 5. Build Group Message
  const barbershopName = groupItems[0].profiles?.business_name || "Barbearia";
  let resumo = "";
  groupItems.forEach((appt, index) => {
    const { date, time } = formatAppointmentDateTimeForMessage(appt);
    resumo += `\n${index + 1}️⃣ Serviço: ${appt.services?.name}\n💈 Profissional: ${appt.barbers?.name}\n📅 Data: ${date}\n⏰ Horário: ${time}\n`;
  });

  const message = `Olá ${customer.name}! 👋\n\nSeus agendamentos na ${barbershopName} foram realizados com sucesso.\n\n📋 Resumo dos agendamentos:\n${resumo}\nO que deseja fazer?`;

  // 6. Send Message
  const connection = await getWhatsAppSettings(supabase, tenantId);
  if (!connection) throw new Error("WhatsApp settings not found for tenant");

  const buttons = [
    { id: "main_confirm", label: "Confirmar agendamento" },
    { id: "main_reschedule", label: "Reagendar" },
    { id: "main_cancel", label: "Cancelar" }
  ];

  const result = await sendMessage(connection, normalizedPhoneValue, message, { buttons });

  // 7. Update records after send
  if (result.success && result.response?.messageId) {
    await supabase.from("conversation_sessions")
      .update({ provider_message_id: result.response.messageId })
      .eq("id", session.id);
      
    await supabase.from("appointments")
      .update({ 
        confirmation_sent: true, 
        confirmation_sent_at: new Date().toISOString() 
      })
      .eq("appointment_group_id", groupId);
  }

  // 8. Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    workflow_id: workflow.id,
    queue_id: queueId,
    session_id: session.id,
    event_name: 'appointment.group_created',
    status: result.success ? "success" : "error",
    message: result.success ? "Mensagem agrupada enviada" : `Erro ao enviar: ${result.error}`,
    error_details: JSON.stringify({ 
      group_id: groupId, 
      group_size: groupItems.length,
      message_type: 'grouped',
      individual_send_blocked: true,
      loop_blocked: true
    })
  });

  return result;
}
