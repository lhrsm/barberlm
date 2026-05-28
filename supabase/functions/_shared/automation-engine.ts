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
  const isMultiple = appointmentIds.length > 1;
  const option = { id: option_id };

  let nextState = current_state;
  let messageToSend = "";
  let menuToSend: any = null;
  let actionExecuted = "";

  console.log('CONVERSATION', conversation);
  console.log('APPOINTMENTS COUNT', appointmentIds.length);
  console.log('IS MULTIPLE', isMultiple);
  console.log('SELECTED OPTION', option);

  // State Machine Logic
  switch (current_state) {
    case AUTOMATION_STATES.AWAITING_MAIN_ACTION:
      if (option_id === 'confirm_appointment') {
        if (!isMultiple) {
          // Confirm direct
          const apptId = appointmentIds[0];
          await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", apptId);
          messageToSend = "✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "confirm_direct";
        } else {
          // Multiple: Ask scope
          messageToSend = "Como você deseja confirmar seus agendamentos?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Confirmar",
              options: [
                { id: 'confirm_all', title: 'Confirmar todos', description: 'Confirmar todos os atendimentos deste pedido' },
                { id: 'confirm_specific', title: 'Escolher um atendimento', description: 'Escolher qual atendimento deseja confirmar' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE;
          actionExecuted = "ask_confirmation_scope";
        }
      } else if (option_id === 'reschedule_appointment') {
        if (!isMultiple) {
          messageToSend = "Para reagendar seu atendimento, por favor entre em contato conosco ou acesse nosso portal de agendamentos.";
          nextState = AUTOMATION_STATES.COMPLETED;
          actionExecuted = "reschedule_direct";
        } else {
          messageToSend = "Como você deseja reagendar seus agendamentos?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Reagendar",
              options: [
                { id: 'reschedule_all', title: 'Reagendar todos', description: 'Reagendar todos os atendimentos deste pedido' },
                { id: 'reschedule_specific', title: 'Escolher um atendimento', description: 'Escolher qual atendimento deseja reagendar' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_RESCHEDULE_SCOPE;
          actionExecuted = "ask_reschedule_scope";
        }
      } else if (option_id === 'cancel_appointment') {
        if (!isMultiple) {
          messageToSend = "Você realmente deseja cancelar seu agendamento?";
          menuToSend = {
            list: {
              buttonLabel: "Confirmar",
              title: "Cancelar",
              options: [
                { id: 'cancel_confirm_yes', title: 'Sim, cancelar', description: 'Confirmar o cancelamento do agendamento' },
                { id: 'cancel_confirm_no', title: 'Não, manter', description: 'Manter meu agendamento' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_confirmation";
        } else {
          messageToSend = "Como você deseja cancelar seus agendamentos?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Cancelar",
              options: [
                { id: 'cancel_all', title: 'Cancelar todos', description: 'Cancelar todos os atendimentos deste pedido' },
                { id: 'cancel_specific', title: 'Escolher um atendimento', description: 'Escolher qual atendimento deseja cancelar' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_CANCEL_SCOPE;
          actionExecuted = "ask_cancel_scope";
        }
      }
      break;

    case AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE:
      if (option_id === 'confirm_all') {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
        messageToSend = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_all";
      } else if (option_id === 'confirm_specific') {
        const { data: appts } = await supabase.from("appointments").select("id, start_time, services(name)").in("id", appointmentIds);
        messageToSend = "Qual atendimento você deseja confirmar?";
        menuToSend = {
          list: {
            buttonLabel: "Ver atendimentos",
            title: "Selecione",
            options: appts.map((a: any) => ({
              id: `appointment_confirm_${a.id}`,
              title: `${formatBrazilTime(a.start_time)} - ${a.services?.name}`,
              description: `Confirmar apenas este atendimento`
            }))
          }
        };
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_appointment_confirm";
      }
      break;

    case AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION:
      if (option_id.startsWith('appointment_confirm_')) {
        const selectedId = option_id.replace('appointment_confirm_', '');
        await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", selectedId);
        
        const remainingIds = appointmentIds.filter((id: string) => id !== selectedId);
        
        if (remainingIds.length > 0) {
          messageToSend = "✅ Agendamento confirmado! O que deseja fazer com os demais agendamentos?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Restantes",
              options: [
                { id: 'confirm_remaining', title: 'Confirmar demais', description: 'Confirmar os demais agendamentos' },
                { id: 'reschedule_remaining', title: 'Reagendar demais', description: 'Reagendar os demais agendamentos' },
                { id: 'cancel_remaining', title: 'Cancelar demais', description: 'Cancelar os demais agendamentos' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION;
          
          await supabase.from("automation_conversations")
            .update({ 
              selected_appointment_id: selectedId,
              remaining_appointment_ids: remainingIds,
              current_state: nextState
            })
            .eq("id", conversation.id);
        } else {
          messageToSend = "✅ Agendamento confirmado com sucesso!";
          nextState = AUTOMATION_STATES.COMPLETED;
        }
        actionExecuted = `confirm_specific_${selectedId}`;
      }
      break;

    case AUTOMATION_STATES.AWAITING_CANCEL_SCOPE:
      if (option_id === 'cancel_confirm_yes' || option_id === 'cancel_all') {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", appointmentIds);
        messageToSend = "❌ Agendamento(s) cancelado(s) com sucesso.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_executed";
      } else if (option_id === 'cancel_confirm_no') {
        messageToSend = "Perfeito! Seu agendamento continua mantido. Te esperamos!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_aborted";
      }
      break;
      
    case AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION:
      const remainingIds = conversation.remaining_appointment_ids || [];
      if (option_id === 'confirm_remaining') {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", remainingIds);
        messageToSend = "✅ Todos os agendamentos restantes foram confirmados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_remaining_executed";
      } else if (option_id === 'cancel_remaining') {
        await supabase.from("appointments").update({ status: 'cancelled' }).in("id", remainingIds);
        messageToSend = "❌ Agendamentos restantes foram cancelados.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "cancel_remaining_executed";
      } else if (option_id === 'reschedule_remaining') {
        messageToSend = "Para reagendar os demais atendimentos, por favor entre em contato conosco.";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "reschedule_remaining_executed";
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

    message += `O que deseja fazer?`;

    const menu = {
      list: {
        buttonLabel: "Ver opções",
        title: "Opções",
        options: [
          { 
            id: 'confirm_appointment', 
            title: 'Confirmar Agendamento', 
            description: isMultiple ? 'Confirmar todos ou escolher um' : 'Confirmar este atendimento' 
          },
          { id: 'reschedule_appointment', title: 'Reagendar', description: isMultiple ? 'Reagendar todos ou escolher um' : 'Alterar data ou horário' },
          { id: 'cancel_appointment', title: 'Cancelar', description: isMultiple ? 'Cancelar todos ou escolher um' : 'Cancelar atendimento' }
        ]
      }
    };

    const sendResult = await sendMessage(connection, customer.phone, message, menu);

    await supabase.from("automation_dispatches").insert({
      tenant_id: tenant.id,
      automation_type: AUTOMATION_TYPES.CONFIRMATION,
      customer_id: customer.id,
      unique_key: uniqueKey,
      status: sendResult.success ? 'sent' : 'failed',
      sent_at: new Date().toISOString()
    });

    await supabase.from("automation_logs").insert({
      tenant_id: tenant.id,
      automation_id: automation.id,
      customer_id: customer.id,
      appointment_id: firstAppt.id,
      phone: customer.phone,
      direction: 'outgoing',
      message_type: AUTOMATION_TYPES.CONFIRMATION,
      processed_template: message,
      payload: menu,
      status: sendResult.success ? 'success' : 'error',
      error_message: sendResult.success ? null : sendResult.error,
      response: sendResult.response,
      sent_at: new Date().toISOString()
    });

    if (sendResult.success) {
      sentCount++;
      await supabase.from("automation_conversations").insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        phone: customer.phone,
        automation_type: AUTOMATION_TYPES.CONFIRMATION,
        automation_id: automation.id,
        appointment_ids: group.map(a => a.id),
        current_state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
        status: 'active'
      });

      await supabase.from("appointments").update({ confirmation_sent: true }).in("id", group.map(a => a.id));
    }
  }

  return sentCount;
}

async function processReminderDispatch(supabase: any, tenant: any, automation: any, connection: any, forceMode: boolean) {
  return 0;
}
