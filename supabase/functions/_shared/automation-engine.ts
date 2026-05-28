import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, parse } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";
import { formatBrazilDate, formatBrazilTime } from "./utils.ts";
import { sendMessage, getWhatsAppSettings } from "./whatsapp-settings.ts";

export const AUTOMATION_STATES = {
  AWAITING_MAIN_ACTION: 'AWAITING_MAIN_ACTION',
  AWAITING_CONFIRMATION_SCOPE: 'AWAITING_CONFIRMATION_SCOPE',
  AWAITING_SPECIFIC_APPOINTMENT_SELECTION: 'AWAITING_SPECIFIC_APPOINTMENT_SELECTION',
  AWAITING_REMAINING_APPOINTMENT_ACTION: 'AWAITING_REMAINING_APPOINTMENT_ACTION',
  AWAITING_RESCHEDULE_SCOPE: 'AWAITING_RESCHEDULE_SCOPE',
  AWAITING_CANCEL_SCOPE: 'AWAITING_CANCEL_SCOPE',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

export const AUTOMATION_TYPES = {
  CONFIRMATION: 'appointment_confirmation',
  REMINDER: 'appointment_reminder',
  RESCHEDULING: 'rescheduling',
  CANCELLATION: 'cancellation',
  BIRTHDAY: 'birthday',
  INACTIVE: 'inactive_customer',
  POST_SERVICE: 'post_service',
  PROFESSIONAL_CONFIRMATION: 'professional_confirmation',
  SERVICE_RATING: 'service_rating',
  MANUAL_PROMOTION: 'manual_promotion',
  CANCELLATION_RECOVERY: 'cancellation_recovery',
  DAY_REMINDER: 'day_reminder'
};

export async function handleAutomationWhatsappResponse(
  supabase: any,
  {
    tenant_id,
    phone,
    customer_id,
    automation_type,
    current_state,
    option_id,
    payload
  }: any
) {
  console.log(`[AutomationEngine] Handling response for ${phone} in state ${current_state} with option ${option_id}`);

  // Fetch active conversation
  const { data: conversation, error: convError } = await supabase
    .from("automation_conversations")
    .select("*")
    .eq("phone", phone)
    .eq("tenant_id", tenant_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    console.log("[AutomationEngine] No active conversation found.");
    return null;
  }

  const appointmentIds = conversation.appointment_ids || [];
  const { data: appointments } = await supabase.from("appointments").select("*, services(name)").in("id", appointmentIds);
  const isMultiple = appointmentIds.length > 1;
  const option = { id: option_id };

  let nextState = current_state;
  let messageToSend = "";
  let menuToSend: any = null;
  let actionExecuted = "";

  console.log('CONVERSATION', conversation);
  console.log('APPOINTMENTS FOUND', appointments);
  console.log('APPOINTMENTS COUNT', appointments?.length || 0);
  console.log('IS MULTIPLE', isMultiple);
  console.log('SELECTED OPTION', option);

  // State Machine Logic
  switch (current_state) {
    case AUTOMATION_STATES.AWAITING_MAIN_ACTION:
      // Map numeric responses to internal actions
      const mainOption = String(option_id).trim();
      
      if (mainOption === '1') { // Confirmar
        if (!isMultiple) {
          // Confirm direct
          const apptId = appointmentIds[0];
          await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", apptId);
          messageToSend = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "confirm_direct";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja confirmar seus agendamentos?\n\nDigite:\n1 - Confirmar todos\n2 - Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE;
          actionExecuted = "ask_confirmation_scope";
        }
      } else if (mainOption === '2') { // Reagendar
        if (!isMultiple) {
          messageToSend = "Para reagendar seu atendimento, por favor entre em contato conosco ou acesse nosso portal de agendamentos: https://agendamento.barber.com.br";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "reschedule_direct";
        } else {
          messageToSend = "Como você deseja reagendar seus agendamentos?\n\nDigite:\n1 - Reagendar todos\n2 - Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_SCOPE;
          actionExecuted = "ask_reschedule_scope";
        }
      } else if (mainOption === '3') { // Cancelar
        if (!isMultiple) {
          messageToSend = "Você realmente deseja cancelar seu agendamento?\n\nDigite:\n1 - Sim, cancelar\n2 - Não, manter";
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_confirmation";
        } else {
          messageToSend = "Como você deseja cancelar seus agendamentos?\n\nDigite:\n1 - Cancelar todos\n2 - Escolher um específico";
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_scope";
        }
      } else {
        // Resposta inválida
        messageToSend = "Não consegui entender sua resposta. 🤔\n\nPor favor, digite apenas o número da opção desejada:\n\n1 - Confirmar agendamento\n2 - Reagendar\n3 - Cancelar";
        actionExecuted = "invalid_option_main";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE:
      if (option_id === '1') { // Confirmar todos
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
        messageToSend = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_all";
      } else if (option_id === '2') { // Escolher um
        const { data: appts } = await supabase.from("appointments").select("id, start_time, services(name)").in("id", appointmentIds);
        messageToSend = "Qual atendimento você deseja confirmar?\n\nDigite o número correspondente:\n\n";
        appts.forEach((a: any, i: number) => {
          messageToSend += `${i + 1} - ${formatBrazilTime(a.start_time)}: ${a.services?.name}\n`;
        });
        
        // Store the order of appointments to map the numeric selection back to ID
        await supabase.from("automation_conversations")
          .update({ 
            metadata: { appt_mapping: appts.map((a: any) => a.id) }
          })
          .eq("id", conversation.id);
          
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_appointment_confirm";
      } else {
        messageToSend = "Opção inválida. Digite 1 para confirmar todos ou 2 para escolher um específico.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION:
      const mapping = conversation.metadata?.appt_mapping || [];
      const index = parseInt(option_id) - 1;
      const isCancelMode = conversation.metadata?.cancel_mode === true;
      
      if (!isNaN(index) && index >= 0 && index < mapping.length) {
        const selectedId = mapping[index];
        const newStatus = isCancelMode ? 'cancelled' : 'confirmed';
        await supabase.from("appointments").update({ status: newStatus }).eq("id", selectedId);
        
        const remainingIds = appointmentIds.filter((id: string) => id !== selectedId);
        
        if (remainingIds.length > 0) {
          const actionText = isCancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${actionText}! O que deseja fazer com os demais agendamentos?\n\nDigite:\n1 - Confirmar demais\n2 - Reagendar demais\n3 - Cancelar demais`;
          nextState = AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION;
          
          await supabase.from("automation_conversations")
            .update({ 
              selected_appointment_id: selectedId,
              remaining_appointment_ids: remainingIds,
              current_state: nextState
            })
            .eq("id", conversation.id);
        } else {
          const successText = isCancelMode ? "cancelado" : "confirmado";
          messageToSend = `✅ Agendamento ${successText} com sucesso!`;
          nextState = AUTOMATION_STATES.COMPLETED;
        }
        actionExecuted = `${isCancelMode ? 'cancel' : 'confirm'}_specific_${selectedId}`;
      } else {
        messageToSend = "Opção inválida. Por favor, digite o número correspondente ao atendimento desejado.";
      }
      break;

    case AUTOMATION_STATES.AWAITING_CANCEL_SCOPE:
      if (option_id === '1') { // Sim, cancelar ou Cancelar todos
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Agendamento(s) cancelado(s) com sucesso.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_executed";
      } else if (option_id === '2') { // Não, manter ou Escolher específico
        if (isMultiple) {
          // Similar to confirm specific
          const { data: appts } = await supabase.from("appointments").select("id, start_time, services(name)").in("id", appointmentIds);
          messageToSend = "Qual atendimento você deseja cancelar?\n\nDigite o número correspondente:\n\n";
          appts.forEach((a: any, i: number) => {
            messageToSend += `${i + 1} - ${formatBrazilTime(a.start_time)}: ${a.services?.name}\n`;
          });
          
          await supabase.from("automation_conversations")
            .update({ 
              metadata: { appt_mapping: appts.map((a: any) => a.id), cancel_mode: true }
            })
            .eq("id", conversation.id);
            
          nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION; // Reuse this state but check cancel_mode
          actionExecuted = "ask_specific_appointment_cancel";
        } else {
          messageToSend = "Perfeito! Seu agendamento continua mantido. Te esperamos!";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "cancel_aborted";
        }
      } else {
        messageToSend = "Opção inválida. Digite 1 ou 2.";
      }
      break;
      
    case AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION:
      const remainingIdsAction = conversation.remaining_appointment_ids || [];
      if (option_id === '1') { // Confirmar demais
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", remainingIdsAction);
        messageToSend = "✅ Todos os agendamentos restantes foram confirmados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_remaining_executed";
      } else if (option_id === '2') { // Reagendar demais
        messageToSend = "Para reagendar os demais atendimentos, por favor entre em contato conosco.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "reschedule_remaining_executed";
      } else if (option_id === '3') { // Cancelar demais
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", remainingIdsAction);
        messageToSend = "❌ Agendamentos restantes foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_remaining_executed";
      } else {
        messageToSend = "Opção inválida. Digite 1, 2 ou 3.";
      }
      break;
  }

  console.log('NEXT STATE', nextState);

  // Update conversation state
  await supabase.from("automation_conversations")
    .update({ 
      current_state: nextState,
      last_option_id: option_id,
      status: nextState === AUTOMATION_STATES.COMPLETED ? 'completed' : 'active',
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation.id);

  return {
    action_executed: actionExecuted,
    next_state: nextState,
    message_to_send: messageToSend,
    menu_to_send: menuToSend,
    conversation_id: conversation.id
  };
}

export async function processAutomationDispatches(
  supabase: any, 
  { tenantId, appointmentId, forceMode }: { tenantId?: string, appointmentId?: string, forceMode?: boolean }
) {
  console.log(`[AutomationEngine] Starting dispatch process. Tenant: ${tenantId || 'All'}, AppointmentId: ${appointmentId || 'All'}`);

  // 1. Get Tenants
  let tenantQuery = supabase.from("barbershops").select("id, name");
  if (tenantId) {
    tenantQuery = tenantQuery.eq("id", tenantId);
  }
  const { data: tenants } = await tenantQuery;

  const results = {
    processed_tenants: tenants?.length || 0,
    dispatches_sent: 0,
    errors: [] as string[]
  };

  for (const tenant of tenants || []) {
    try {
      // 2. Get active automations for tenant
      const { data: automations } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("enabled", true);

      if (!automations || automations.length === 0) {
        console.log(`[AutomationEngine] No active automations for tenant ${tenant.id}`);
        continue;
      }

      // 3. Get Z-API connection
      const connection = await getWhatsAppSettings(supabase, tenant.id);
      if (!connection) {
        console.log(`[AutomationEngine] No WhatsApp connection found for tenant ${tenant.id}`);
        continue;
      }

      if (!connection.connected) {
        console.log(`[AutomationEngine] WhatsApp connection not connected for tenant ${tenant.id}`);
        continue;
      }

      for (const automation of automations) {
        if (automation.type === AUTOMATION_TYPES.CONFIRMATION) {
          const sentCount = await processConfirmationDispatch(supabase, tenant, automation, connection, appointmentId, forceMode);
          results.dispatches_sent += sentCount;
        } else if (automation.type === AUTOMATION_TYPES.REMINDER && !appointmentId) {
          const sentCount = await processReminderDispatch(supabase, tenant, automation, connection, forceMode);
          results.dispatches_sent += sentCount;
        }
      }
    } catch (err: any) {
      console.error(`[AutomationEngine] Error in tenant ${tenant.name}:`, err);
      results.errors.push(`Tenant ${tenant.name}: ${err.message}`);
    }
  }

  return results;
}

async function processConfirmationDispatch(
  supabase: any, 
  tenant: any, 
  automation: any, 
  connection: any, 
  appointmentId?: string,
  forceMode?: boolean
) {
  console.log(`[AutomationEngine] Processing CONFIRMATION for tenant ${tenant.name}. AppointmentId: ${appointmentId || 'All'}`);

  let query = supabase
    .from("appointments")
    .select("*, customers(*), services(name), barbers(name)")
    .eq("tenant_id", tenant.id)
    .eq("status", "scheduled")
    .eq("confirmation_sent", false);

  if (appointmentId) {
    const { data: specificAppt } = await supabase.from("appointments").select("appointment_group_id").eq("id", appointmentId).maybeSingle();
    if (specificAppt?.appointment_group_id) {
      query = query.eq("appointment_group_id", specificAppt.appointment_group_id);
    } else {
      query = query.eq("id", appointmentId);
    }
  } else {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    query = query.gte("created_at", fifteenMinsAgo);
  }

  const { data: appointments, error: apptError } = await query;

  if (apptError || !appointments || appointments.length === 0) {
    return 0;
  }

  const groups: Record<string, any[]> = {};
  for (const appt of appointments) {
    const key = appt.appointment_group_id || `single_${appt.id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(appt);
  }

  let sentCount = 0;

  for (const groupKey in groups) {
    const group = groups[groupKey];
    const firstAppt = group[0];
    const customer = firstAppt.customers;
    
    if (!customer?.phone) continue;

    const uniqueKey = `conf:${tenant.id}:${groupKey}`;
    
    if (!forceMode) {
      const { data: existing } = await supabase
        .from("automation_dispatches")
        .select("id")
        .eq("unique_key", uniqueKey)
        .maybeSingle();
      if (existing) continue;
    }

    const isMultiple = group.length > 1;
    let message = `Olá ${customer.name}! 👋\n\n`;
    message += `Seu agendamento na *${tenant.name}* foi realizado com sucesso!\n\n`;
    
    if (isMultiple) {
      message += `Você possui ${group.length} atendimentos:\n\n`;
      group.forEach((a, i) => {
        message += `${i+1}️⃣ ${a.services?.name} com ${a.barbers?.name} às ${formatBrazilTime(a.start_time)}\n`;
      });
      message += `\n📅 Data: ${formatBrazilDate(firstAppt.start_time)}\n\n`;
    } else {
      message += `✅ *${firstAppt.services?.name}*\n`;
      message += `💈 Profissional: ${firstAppt.barbers?.name}\n`;
      message += `📅 Data: ${formatBrazilDate(firstAppt.start_time)}\n`;
      message += `⏰ Horário: ${formatBrazilTime(firstAppt.start_time)}\n\n`;
    }

    message += `Digite uma das opções abaixo:\n\n`;
    message += `1 - Confirmar agendamento\n`;
    message += `2 - Reagendar\n`;
    message += `3 - Cancelar`;

    const sendResult = await sendMessage(connection, customer.phone, message);

    await supabase.from("automation_dispatches").insert({
      tenant_id: tenant.id,
      automation_type: AUTOMATION_TYPES.CONFIRMATION,
      customer_id: customer.id,
      unique_key: uniqueKey,
      status: sendResult.success ? 'sent' : 'failed',
      sent_at: new Date().toISOString()
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase.from("automation_logs").insert({
      tenant_id: tenant.id,
      automation_id: automation.id,
      customer_id: customer.id,
      appointment_id: firstAppt.id,
      phone: customer.phone,
      direction: 'outgoing',
      message_type: AUTOMATION_TYPES.CONFIRMATION,
      processed_template: message,
      status: sendResult.success ? 'success' : 'error',
      error_message: sendResult.success ? null : sendResult.error,
      response: sendResult.response,
      sent_at: new Date().toISOString()
    });

    if (sendResult.success) {
      sentCount++;
      // First, ensure any old active conversations for this phone/tenant are closed
      await supabase.from("automation_conversations")
        .update({ status: 'expired' })
        .eq("phone", customer.phone)
        .eq("tenant_id", tenant.id)
        .eq("status", "active");

      await supabase.from("automation_conversations").insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        phone: customer.phone,
        automation_type: AUTOMATION_TYPES.CONFIRMATION,
        automation_id: automation.id,
        appointment_ids: group.map(a => a.id),
        current_state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
        status: 'active',
        expires_at: expiresAt.toISOString()
      });

      await supabase.from("appointments").update({ confirmation_sent: true }).in("id", group.map(a => a.id));
    }
  }

  return sentCount;
}

async function processReminderDispatch(supabase: any, tenant: any, automation: any, connection: any, forceMode: boolean) {
  return 0;
}
