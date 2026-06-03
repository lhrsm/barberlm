import { AUTOMATION_STATES, FLOW_TYPES } from "../../_shared/automation-engine.ts";
import { formatAppointmentDateTimeForMessage, normalizePhone, formatBrazilTime } from "../../_shared/utils.ts";
import { sendMessage, getWhatsAppSettings } from "../../_shared/whatsapp-settings.ts";

export async function processMultiAppointmentAutomation(supabase: any, item: any, workflow: any) {
  const tenantId = item.tenant_id;
  const groupId = item.appointment_group_id;

  if (!groupId) throw new Error("Missing appointment_group_id for multi flow");

  // 1. Fetch group data
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name), profiles:tenant_id(business_name)")
    .eq("appointment_group_id", groupId)
    .order("start_time", { ascending: true });

  if (error || !appointments || appointments.length === 0) throw new Error(`Group not found: ${groupId}`);
  
  const mainAppointment = appointments[0];
  const customer = mainAppointment.customers;
  if (!customer?.phone) throw new Error("Customer phone not found");
  const normalizedPhone = normalizePhone(customer.phone);

  // 2. Anti-loop check (if any already sent confirmation)
  if (appointments.some(a => a.confirmation_sent_at)) {
    console.log(`[MultiFlow] Already sent for group ${groupId}`);
    return { success: true, message: "Already sent" };
  }

  // 3. Deactivate previous sessions
  await supabase.from("conversation_sessions")
    .update({ status: 'closed', active: false, closed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("phone", normalizedPhone)
    .eq("status", "active");

  // 4. Create Session
  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      phone: normalizedPhone,
      channel: 'whatsapp',
      flow_type: FLOW_TYPES.MULTI,
      current_step: AUTOMATION_STATES.MULTI_AWAITING_MAIN_ACTION,
      status: 'active',
      appointment_group_id: groupId,
      context: {
        appointment_group_id: groupId,
        appointment_ids: appointments.map(a => a.id),
        customer_name: customer.name
      }
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 5. Build Message
  let apptsList = "";
  appointments.forEach((a, i) => {
    const { date, time } = formatAppointmentDateTimeForMessage(a);
    apptsList += `\n${i + 1}️⃣ *${a.services?.name}*\n📅 ${date} às ${time}\n👤 ${a.barbers?.name}\n`;
  });

  const message = `Olá ${customer.name || 'Cliente'}, recebemos seus agendamentos na ${mainAppointment.profiles?.business_name || 'Barbearia'}!\n\n📌 *Resumo do seu grupo:*${apptsList}\nO que você deseja fazer?`;

  const buttons = [
    { id: "main_confirm", label: "Confirmar agendamentos" },
    { id: "main_reschedule", label: "Reagendar" },
    { id: "main_cancel", label: "Cancelar" }
  ];

  // 6. Send
  const connection = await getWhatsAppSettings(supabase, tenantId);
  if (!connection) throw new Error("WhatsApp settings not found");

  const result = await sendMessage(connection, normalizedPhone, message, { buttons });

  if (result.success && result.response?.messageId) {
    await supabase.from("conversation_sessions")
      .update({ provider_message_id: result.response.messageId })
      .eq("id", session.id);

    // Mark ALL in group
    await supabase.from("appointments")
      .update({ confirmation_sent: true, confirmation_sent_at: new Date().toISOString() })
      .eq("appointment_group_id", groupId);
  }

  // 7. Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session.id,
    queue_id: item.id,
    flow_type: FLOW_TYPES.MULTI,
    current_step_after: AUTOMATION_STATES.MULTI_AWAITING_MAIN_ACTION,
    action: "initial_multi_message_sent",
    status: result.success ? "success" : "error",
    message: result.success ? "Mensagem agrupada enviada" : `Erro Z-API: ${result.error}`
  });

  return result;
}
