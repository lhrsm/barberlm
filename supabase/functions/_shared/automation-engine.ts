import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, parse } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";
import { formatBrazilDate, formatBrazilTime, normalizePhone } from "./utils.ts";
import { sendMessage, getWhatsAppSettings } from "./whatsapp-settings.ts";
import { processAutomationTemplate, containsPlaceholders } from "./template-parser.ts";

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
      messageToSend = "Não consegui entender sua escolha. 🤔\n\nUse o menu de opções ou responda:\n1️⃣ Confirmar\n2️⃣ Reagendar\n3️⃣ Cancelar";
      break;
  }

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
  const runId = crypto.randomUUID();
  console.log(`[AutomationEngine] Starting dispatch process ${runId}. Tenant: ${tenantId || 'All'}, Appointment: ${appointmentId || 'All'}, Force: ${forceMode}`);
  
  await supabase.from("automation_cron_runs").insert({
    id: runId,
    status: 'running',
    tenant_id: tenantId,
    appointment_id: appointmentId
  });

  const results = {
    success: true,
    processed_count: 0,
    error_count: 0,
    messages_sent: [] as any[],
    errors: [] as any[]
  };

  try {
    let query = supabase
      .from("appointments")
      .select("*, customers(*), barbers(*), services(*), profiles:tenant_id(business_name)")
      .eq("status", "pending")
      .is("confirmation_sent_at", null);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (appointmentId) query = query.eq("id", appointmentId);
    
    const { data: appointments, error: appError } = await query;

    if (appError) throw appError;
    if (!appointments || appointments.length === 0) {
      console.log("[AutomationEngine] No pending appointments found.");
      await supabase.from("automation_cron_runs").update({ status: 'success', finished_at: new Date().toISOString() }).eq('id', runId);
      return { ...results, message: "No pending appointments found" };
    }

    const groups: Record<string, any[]> = {};
    for (const appt of appointments) {
      const key = appt.appointment_group_id || `${appt.tenant_id}_${appt.customers?.phone}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(appt);
    }

    for (const [groupKey, apptGroup] of Object.entries(groups)) {
      try {
        const firstAppt = apptGroup[0];
        const tenant_id = firstAppt.tenant_id;
        const customer = firstAppt.customers;
        const profile = firstAppt.profiles;
        
        if (!customer?.phone) continue;

        const { data: auto } = await supabase
          .from("automations")
          .select("*")
          .eq("tenant_id", tenant_id)
          .eq("type", AUTOMATION_TYPES.CONFIRMATION)
          .eq("enabled", true)
          .maybeSingle();

        if (!auto) continue;

        const isMultiple = apptGroup.length > 1;
        let message = "";
        
        if (!isMultiple) {
          const appt = firstAppt;
          const templateData = {
            customer_name: customer.name,
            barbershop_name: profile?.business_name,
            service_name: appt.services?.name,
            professional_name: appt.barbers?.name,
            appointment_date: formatBrazilDate(appt.start_time),
            appointment_time: formatBrazilTime(appt.start_time),
            service_price: appt.final_amount ? `R$ ${appt.final_amount.toFixed(2).replace('.', ',')}` : "R$ 0,00"
          };
          
          const rawTemplate = auto.template || `Olá {{customer_name}} 👋\n\nSeu agendamento na {{barbershop_name}} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {{service_name}}\n💈 Profissional: {{professional_name}}\n📅 Data: {{appointment_date}}\n⏰ Horário: {{appointment_time}}\n💰 Valor: {{service_price}}\n\nO que deseja fazer?`;
          
          message = processAutomationTemplate(rawTemplate, templateData);
          
          if (containsPlaceholders(message)) {
            console.error('Message still contains placeholders', message);
            results.errors.push({ group: groupKey, error: 'Placeholders remaining' });
            continue;
          }
        } else {
          let appointmentsList = "";
          apptGroup.forEach((appt, i) => {
            appointmentsList += `${i + 1}️⃣ ${appt.services?.name}\n💈 ${appt.barbers?.name}\n📅 ${formatBrazilDate(appt.start_time)}\n⏰ ${formatBrazilTime(appt.start_time)}\n\n`;
          });

          const templateData = {
            customer_name: customer.name,
            barbershop_name: profile?.business_name,
            appointments_list: appointmentsList.trim()
          };

          const rawTemplate = `Olá {{customer_name}} 👋\n\nVocê possui {{count}} agendamentos na {{barbershop_name}}.\n\n📋 Resumo dos agendamentos:\n\n{{appointments_list}}\n\nO que deseja fazer?`
            .replace("{{count}}", String(apptGroup.length));

          message = processAutomationTemplate(rawTemplate, templateData);
          
          if (containsPlaceholders(message)) {
            console.error('Message still contains placeholders', message);
            results.errors.push({ group: groupKey, error: 'Placeholders remaining' });
            continue;
          }
        }

        const connection = await getWhatsAppSettings(supabase, tenant_id);
        if (!connection) continue;

        const buttons = [
          { id: "main_confirm", label: "Confirmar agendamento" },
          { id: "main_reschedule", label: "Reagendar" },
          { id: "main_cancel", label: "Cancelar" }
        ];

        const sendResult = await sendMessage(connection, customer.phone, message, { buttons });
        
        const logData = {
          barber_id: tenant_id,
          phone: normalizePhone(customer.phone),
          webhook_type: auto.type,
          direction: 'outgoing',
          status: sendResult.success ? 'success' : 'error',
          error_message: sendResult.error,
          message_sent: message,
          appointment_id: !isMultiple ? firstAppt.id : null,
          appointment_group_id: firstAppt.appointment_group_id
        };

        await supabase.from("automation_logs").insert(logData);
        results.messages_sent.push(logData);

        if (sendResult.success) {
          results.processed_count++;
          
          await supabase.from("whatsapp_conversations").insert({
            barber_id: tenant_id,
            customer_id: customer.id,
            phone: normalizePhone(customer.phone),
            state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
            active: true,
            appointment_group_id: firstAppt.appointment_group_id,
            appointment_id: !isMultiple ? firstAppt.id : null,
            context: {
              appointment_ids: apptGroup.map(a => a.id),
              multiple: isMultiple
            }
          });

          const nowIso = new Date().toISOString();
          await supabase.from("appointments")
            .update({ 
              confirmation_sent: true, 
              confirmation_sent_at: nowIso 
            })
            .in("id", apptGroup.map(a => a.id));
        } else {
          results.error_count++;
        }

      } catch (err: any) {
        console.error(`[AutomationEngine] Error processing group ${groupKey}:`, err);
        results.error_count++;
        results.errors.push({ group: groupKey, error: err.message });
      }
    }

    await supabase.from("automation_cron_runs").update({
      status: results.error_count === 0 ? 'success' : 'error',
      finished_at: new Date().toISOString(),
      processed_count: results.processed_count,
      error_count: results.error_count,
      errors: results.errors
    }).eq('id', runId);

    return results;

  } catch (error: any) {
    console.error("[AutomationEngine] Fatal error in dispatches:", error);
    await supabase.from("automation_cron_runs").update({ 
      status: 'error', 
      finished_at: new Date().toISOString(),
      errors: [{ fatal: error.message }]
    }).eq('id', runId);
    return { ...results, success: false, error: error.message };
  }
}
