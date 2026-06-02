import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, parse } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";
import { formatBrazilDate, formatBrazilTime, normalizePhone } from "./utils.ts";
import { sendMessage, getWhatsAppSettings } from "./whatsapp-settings.ts";

export const AUTOMATION_STATES = {
  AWAITING_MAIN_ACTION: 'awaiting_main_action',
  AWAITING_CONFIRMATION_SCOPE: 'awaiting_confirm_scope',
  AWAITING_SPECIFIC_APPOINTMENT_SELECTION: 'awaiting_specific_selection',
  AWAITING_REMAINING_APPOINTMENT_ACTION: 'awaiting_remaining_action',
  AWAITING_RESCHEDULE_SCOPE: 'awaiting_reschedule_scope',
  AWAITING_CANCEL_CONFIRMATION: 'awaiting_cancel_confirmation',
  AWAITING_CANCEL_SCOPE: 'awaiting_cancel_scope',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

export const AUTOMATION_TYPES = {
  CONFIRMATION: 'appointment_confirmation',
  REMINDER: 'appointment_reminder',
  RESCHEDULING: 'rescheduling',
  CANCELLATION: 'cancellation'
};

export async function handleAutomationWhatsappResponse(
  supabase: any,
  {
    tenant_id,
    phone,
    customer_id,
    current_state,
    option_id,
    payload,
    conversation_id
  }: any
) {
  console.log(`[AutomationEngine] Handling response for ${phone} in state ${current_state} with option ${option_id}`);

  // Fetch active conversation from whatsapp_conversations or automation_conversations
  // The user asked to use whatsapp_conversations or automation_conversations logic
  // Based on zapi-webhook/index.ts, we use whatsapp_conversations
  const { data: conversation, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conversation) {
    console.log("[AutomationEngine] No conversation found for ID:", conversation_id);
    return null;
  }

  const groupId = conversation.appointment_group_id;
  
  // Get appointments for this group
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, services(name)")
    .eq("appointment_group_id", groupId);

  const isMultiple = appointments && appointments.length > 1;
  const appointmentIds = appointments?.map(a => a.id) || [];

  let nextState = current_state;
  let messageToSend = "";
  let actionExecuted = "";
  let selectedOptionNormalized = option_id;

  // Normalize option
  const normalizedOption = String(option_id).trim().toLowerCase();

  // State Machine Logic
  switch (current_state) {
    case AUTOMATION_STATES.AWAITING_MAIN_ACTION:
      if (normalizedOption === 'main_confirm' || normalizedOption === '1' || normalizedOption.includes('confirmar')) {
        if (!isMultiple) {
          // Confirm direct
          await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
          messageToSend = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "confirm_direct";
          selectedOptionNormalized = "main_confirm";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja confirmar seus agendamentos?\n\n1️⃣ Confirmar todos\n2️⃣ Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE;
          actionExecuted = "ask_confirmation_scope";
          selectedOptionNormalized = "main_confirm";
        }
      } else if (normalizedOption === 'main_reschedule' || normalizedOption === '2' || normalizedOption.includes('reagendar')) {
        if (!isMultiple) {
          messageToSend = "Para reagendar seu atendimento, por favor entre em contato conosco ou acesse nosso portal de agendamentos.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "reschedule_direct";
          selectedOptionNormalized = "main_reschedule";
        } else {
          messageToSend = "Como você deseja reagendar seus agendamentos?\n\n1️⃣ Reagendar todos\n2️⃣ Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_SCOPE;
          actionExecuted = "ask_reschedule_scope";
          selectedOptionNormalized = "main_reschedule";
        }
      } else if (normalizedOption === 'main_cancel' || normalizedOption === '3' || normalizedOption.includes('cancelar')) {
        if (!isMultiple) {
          messageToSend = "Você realmente deseja cancelar seu agendamento?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter";
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_CONFIRMATION;
          actionExecuted = "ask_cancel_confirmation";
          selectedOptionNormalized = "main_cancel";
        } else {
          messageToSend = "Como você deseja cancelar seus agendamentos?\n\n1️⃣ Cancelar todos\n2️⃣ Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_scope";
          selectedOptionNormalized = "main_cancel";
        }
      } else {
        messageToSend = "Não consegui entender sua escolha. 🤔\n\nUse o menu de opções ou responda:\n1️⃣ Confirmar\n2️⃣ Reagendar\n3️⃣ Cancelar";
        actionExecuted = "invalid_option_main";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE:
      if (normalizedOption === 'confirm_all' || normalizedOption === '1') {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
        messageToSend = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_all";
        selectedOptionNormalized = "confirm_all";
      } else if (normalizedOption === 'confirm_single' || normalizedOption === '2') {
        messageToSend = "Qual atendimento você deseja confirmar?\n\nDigite o número correspondente:\n\n";
        appointments.forEach((a, i) => {
          messageToSend += `${i + 1}️⃣ ${formatBrazilTime(a.start_time)}: ${a.services?.name}\n`;
        });
        
        await supabase.from("whatsapp_conversations")
          .update({ 
            context: { ...conversation.context, appt_mapping: appointmentIds }
          })
          .eq("id", conversation_id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_selection";
        selectedOptionNormalized = "confirm_single";
      } else {
        messageToSend = "Opção inválida. Digite 1 para confirmar todos ou 2 para escolher um específico.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION:
      const mapping = conversation.context?.appt_mapping || appointmentIds;
      const index = parseInt(normalizedOption) - 1;
      const cancelMode = conversation.context?.cancel_mode === true;
      
      if (!isNaN(index) && index >= 0 && index < mapping.length) {
        const selectedId = mapping[index];
        const newStatus = cancelMode ? 'cancelled' : 'confirmed';
        await supabase.from("appointments").update({ status: newStatus }).eq("id", selectedId);
        
        const remainingIds = appointmentIds.filter(id => id !== selectedId);
        
        if (remainingIds.length > 0) {
          const actionText = cancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${actionText}! O que deseja fazer com os demais agendamentos?\n\n1️⃣ Confirmar demais\n2️⃣ Reagendar demais\n3️⃣ Cancelar demais`;
          nextState = AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION;
          
          await supabase.from("whatsapp_conversations")
            .update({ 
              context: { 
                ...conversation.context, 
                selected_appointment_id: selectedId,
                remaining_appointment_ids: remainingIds 
              }
            })
            .eq("id", conversation_id);
        } else {
          const successText = cancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${successText} com sucesso!`;
          nextState = AUTOMATION_STATES.COMPLETED;
        }
        actionExecuted = `${cancelMode ? 'cancel' : 'confirm'}_specific`;
      } else {
        messageToSend = "Opção inválida. Por favor, digite o número correspondente ao atendimento desejado.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CANCEL_CONFIRMATION:
      if (normalizedOption === 'cancel_yes' || normalizedOption === '1' || normalizedOption.includes('sim')) {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Agendamento cancelado com sucesso.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_executed";
        selectedOptionNormalized = "cancel_yes";
      } else if (normalizedOption === 'cancel_no' || normalizedOption === '2' || normalizedOption.includes('nao')) {
        messageToSend = "Perfeito! Seu agendamento continua mantido. Te esperamos!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_aborted";
        selectedOptionNormalized = "cancel_no";
      } else {
        messageToSend = "Opção inválida. Digite 1 para confirmar o cancelamento ou 2 para manter.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CANCEL_SCOPE:
      if (normalizedOption === 'cancel_all' || normalizedOption === '1') {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Todos os seus agendamentos foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_all";
        selectedOptionNormalized = "cancel_all";
      } else if (normalizedOption === 'cancel_single' || normalizedOption === '2') {
        messageToSend = "Qual atendimento você deseja cancelar?\n\nDigite o número correspondente:\n\n";
        appointments.forEach((a, i) => {
          messageToSend += `${i + 1}️⃣ ${formatBrazilTime(a.start_time)}: ${a.services?.name}\n`;
        });
        
        await supabase.from("whatsapp_conversations")
          .update({ 
            context: { ...conversation.context, appt_mapping: appointmentIds, cancel_mode: true }
          })
          .eq("id", conversation_id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_selection_cancel";
        selectedOptionNormalized = "cancel_single";
      } else {
        messageToSend = "Opção inválida. Digite 1 para cancelar todos ou 2 para escolher um específico.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION:
      const remainingIds = conversation.context?.remaining_appointment_ids || [];
      if (normalizedOption === '1' || normalizedOption.includes('confirmar')) {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", remainingIds);
        messageToSend = "✅ Todos os agendamentos restantes foram confirmados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_remaining";
      } else if (normalizedOption === '2' || normalizedOption.includes('reagendar')) {
        messageToSend = "Para reagendar os demais atendimentos, por favor entre em contato conosco.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "reschedule_remaining";
      } else if (normalizedOption === '3' || normalizedOption.includes('cancelar')) {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", remainingIds);
        messageToSend = "❌ Agendamentos restantes foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_remaining";
      } else {
        messageToSend = "Opção inválida. Digite 1, 2 ou 3.";
      }
      break;
      
    default:
      // Fallback
      messageToSend = "Não consegui entender sua escolha. 🤔\n\nUse o menu de opções ou responda:\n1️⃣ Confirmar\n2️⃣ Reagendar\n3️⃣ Cancelar";
      break;
  }

  // Update conversation
  await supabase.from("whatsapp_conversations")
    .update({ 
      state: nextState,
      active: nextState !== AUTOMATION_STATES.COMPLETED,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation_id);

  return {
    action_executed: actionExecuted,
    next_state: nextState,
    message_to_send: messageToSend,
    selected_option_normalized: selectedOptionNormalized
  };
}

export async function processAutomationDispatches(
  supabase: any,
  { tenantId, appointmentId, forceMode }: { tenantId?: string; appointmentId?: string; forceMode?: boolean }
) {
  console.log(`[AutomationEngine] Starting dispatch process. Tenant: ${tenantId || 'All'}, Appointment: ${appointmentId || 'All'}, Force: ${forceMode}`);
  
  const results = {
    success: true,
    appointmentsFound: [] as any[],
    messagesSent: [] as any[],
    errors: [] as any[]
  };

  try {
    // 1. Define time window (reminders for the next 24 hours, or confirmations for new ones)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // 2. Fetch pending appointments that might need automation
    let query = supabase
      .from("appointments")
      .select("*, customers(*), barbers(*), services(*)")
      .in("status", ["pending", "confirmed"]);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (appointmentId) query = query.eq("id", appointmentId);
    
    // Only future appointments unless forceMode
    if (!forceMode && !appointmentId) {
      query = query.gte("start_time", now.toISOString()).lte("start_time", tomorrow.toISOString());
    }

    const { data: appointments, error: appError } = await query;

    if (appError) throw appError;
    if (!appointments || appointments.length === 0) {
      console.log("[AutomationEngine] No appointments found in window.");
      return { ...results, message: "No appointments found" };
    }

    results.appointmentsFound = appointments;
    console.log(`[AutomationEngine] Found ${appointments.length} appointments to check.`);

    // 3. For each appointment, check applicable automations
    for (const appt of appointments) {
      try {
        // Fetch enabled automations for this tenant
        const { data: automations } = await supabase
          .from("automations")
          .select("*")
          .eq("tenant_id", appt.tenant_id)
          .eq("enabled", true);

        if (!automations || automations.length === 0) continue;

        for (const auto of automations) {
          // Check if already sent for this appointment/automation type
          const { data: existingLog } = await supabase
            .from("automation_logs")
            .select("id")
            .eq("appointment_id", appt.id)
            .eq("barber_id", appt.tenant_id)
            .eq("webhook_type", auto.type)
            .eq("status", "success")
            .maybeSingle();

          if (existingLog && !forceMode) {
            console.log(`[AutomationEngine] Automation ${auto.type} already sent for appointment ${appt.id}`);
            continue;
          }

          // Determine if we should send based on trigger type/time (simplified for now)
          // For now, just send confirmation if status is pending, and reminder if confirmed
          const shouldSend = 
            (auto.type === 'appointment_confirmation' && appt.status === 'pending') ||
            (auto.type === 'appointment_reminder' && appt.status === 'confirmed');

          if (!shouldSend && !forceMode) continue;

          // Process template
          const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", appt.tenant_id).single();
          
          const message = auto.template 
            ? auto.template
                .replace("{{cliente_nome}}", appt.customers?.name || "Cliente")
                .replace("{{horario}}", formatBrazilTime(appt.start_time))
                .replace("{{data}}", formatBrazilDate(appt.start_time))
                .replace("{{barbearia_nome}}", profile?.business_name || "Barbearia")
                .replace("{{servico}}", appt.services?.name || "Serviço")
                .replace("{{profissional}}", appt.barbers?.name || "Profissional")
            : `Olá ${appt.customers?.name}, lembrete do seu agendamento em ${profile?.business_name} às ${formatBrazilTime(appt.start_time)}.`;

          // Send WhatsApp
          const connection = await getWhatsAppSettings(supabase, appt.tenant_id);
          if (!connection) {
            console.warn(`[AutomationEngine] No WhatsApp connection for tenant ${appt.tenant_id}`);
            continue;
          }

          const sendResult = await sendMessage(connection, appt.customers?.phone, message);
          
          // Log result
          const logData = {
            barber_id: appt.tenant_id,
            phone: appt.customers?.phone,
            webhook_type: auto.type,
            direction: 'outgoing',
            status: sendResult.success ? 'success' : 'error',
            error_message: sendResult.error,
            message_sent: message,
            appointment_id: appt.id,
            appointment_group_id: appt.appointment_group_id
          };

          await supabase.from("automation_logs").insert(logData);
          results.messagesSent.push(logData);

          // If confirmation, create conversation state
          if (auto.type === 'appointment_confirmation' && sendResult.success) {
            await supabase.from("whatsapp_conversations").insert({
              barber_id: appt.tenant_id,
              customer_id: appt.customer_id,
              phone: normalizePhone(appt.customers?.phone),
              state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
              active: true,
              appointment_group_id: appt.appointment_group_id,
              appointment_id: appt.id
            });
          }
        }
      } catch (apptError: any) {
        console.error(`[AutomationEngine] Error processing appointment ${appt.id}:`, apptError);
        results.errors.push({ appointmentId: appt.id, error: apptError.message });
      }
    }
  } catch (error: any) {
    console.error("[AutomationEngine] Fatal Error:", error);
    results.success = false;
    results.errors.push({ error: error.message });
  }

  return results;
}

function formatBrazilDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function formatBrazilTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-numeric', minute: '2-numeric' });
  } catch {
    return dateStr;
  }
}
