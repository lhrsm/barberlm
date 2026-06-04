import { AUTOMATION_STATES, FLOW_TYPES } from "../../_shared/automation-engine.ts";
import { formatAppointmentDateTimeForMessage, normalizePhone } from "../../_shared/utils.ts";
import { sendMessage, getWhatsAppSettings } from "../../_shared/whatsapp-settings.ts";

export async function processSingleAppointmentAutomation(supabase: any, item: any, workflow: any) {
  const tenantId = item.tenant_id;
  const appointmentId = item.appointment_id || item.entity_id;
  
  // 1. Fetch data
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name), profiles:tenant_id(business_name)")
    .eq("id", appointmentId)
    .single();

  if (error || !appointment) throw new Error(`Appointment not found: ${appointmentId}`);
  if (!appointment.customers?.phone) throw new Error("Customer phone not found");

  const customer = appointment.customers;
  const normalizedPhone = normalizePhone(customer.phone);

  // 2. Anti-loop check
  if (appointment.confirmation_sent_at) {
    console.log(`[SingleFlow] Already sent for ${appointmentId}`);
    return { success: true, message: "Already sent" };
  }

  // 3. Deactivate previous sessions
  await supabase.from("conversation_sessions")
    .update({ status: 'closed', active: false, closed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("phone", normalizedPhone)
    .eq("status", "active");

  // 4. Create Session
  const { date, time } = formatAppointmentDateTimeForMessage(appointment);
  const { data: session, error: sessionError } = await supabase
    .from("conversation_sessions")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      phone: normalizedPhone,
      channel: 'whatsapp',
      flow_type: FLOW_TYPES.SINGLE,
      current_step: AUTOMATION_STATES.SINGLE_AWAITING_MAIN_ACTION,
      status: 'active',
      appointment_id: appointmentId,
      context: {
        appointment_id: appointmentId,
        customer_name: customer.name,
        service_name: appointment.services?.name,
        barber_name: appointment.barbers?.name,
        date,
        time
      }
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 5. Build Message
  // User requested exact template:
  // Olá {customer_name} 👋
  // Seu agendamento na {barbershop_name} foi realizado com sucesso.
  // 📋 Resumo do agendamento:
  // ✅ Serviço: {service_name}
  // 💈 Profissional: {professional_name}
  // 📅 Data: {appointment_date}
  // ⏰ Horário: {appointment_time}
  
  const template = `Olá {customer_name} 👋

Seu agendamento na {barbershop_name} foi realizado com sucesso.

📋 Resumo do agendamento:

✅ Serviço: {service_name}
💈 Profissional: {professional_name}
📅 Data: {appointment_date}
⏰ Horário: {appointment_time}`;
  
  const message = template
    .replace('{customer_name}', customer.name || 'Cliente')
    .replace('{barbershop_name}', appointment.profiles?.business_name || 'Barbearia')
    .replace('{service_name}', appointment.services?.name || 'Serviço')
    .replace('{professional_name}', appointment.barbers?.name || 'Profissional')
    .replace('{appointment_date}', date)
    .replace('{appointment_time}', time);

  const buttons = [
    { id: "main_confirm", label: "Confirmar agendamento" },
    { id: "main_reschedule", label: "Reagendar" },
    { id: "main_cancel", label: "Cancelar" }
  ];

  // 6. Send
  const connection = await getWhatsAppSettings(supabase, tenantId);
  if (!connection) throw new Error("WhatsApp settings not found");

  const result = await sendMessage(connection, normalizedPhone, message, { buttons });

  if (result.success && result.response?.messageId) {
    await supabase.from("conversation_sessions")
      .update({ 
        provider_message_id: result.response.messageId,
        metadata: {
          ...(session.metadata || {}),
          provider_message_id: result.response.messageId,
          appointment_id: appointmentId,
          appointment_group_id: appointment.appointment_group_id,
          flow_type: FLOW_TYPES.SINGLE
        }
      })
      .eq("id", session.id);

    await supabase.from("appointments")
      .update({ 
        confirmation_sent: true, 
        confirmation_sent_at: new Date().toISOString() 
      })
      .eq("id", appointmentId);
  }

  // 7. Log
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    session_id: session.id,
    queue_id: item.id,
    flow_type: FLOW_TYPES.SINGLE,
    current_step_after: AUTOMATION_STATES.SINGLE_AWAITING_MAIN_ACTION,
    action: "initial_single_message_sent",
    status: result.success ? "success" : "error",
    message: result.success ? "Mensagem inicial enviada (Single)" : `Erro Z-API: ${result.error}`,
    appointments_found: 1,
    appointment_group_id: appointment.appointment_group_id,
    flow_type_selected: 'single',
    reason_selected: 'group_contains_one_appointment'
  });

  return result;
}
