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
  AWAITING_RESCHEDULE_SELECTION: 'AWAITING_RESCHEDULE_SELECTION',
  AWAITING_CANCEL_SELECTION: 'AWAITING_CANCEL_SELECTION',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED'
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

  let nextState = current_state;
  let messageToSend = "";
  let menuToSend: any = null;
  let actionExecuted = "";

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
          messageToSend = "O que deseja confirmar?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Confirmar",
              options: [
                { id: 'confirm_all', title: 'Todos os agendamentos', description: 'Confirmar todos os atendimentos deste pedido' },
                { id: 'confirm_specific', title: 'Um agendamento específico', description: 'Escolher qual atendimento deseja confirmar' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE;
          actionExecuted = "ask_confirmation_scope";
        }
      } else if (option_id === 'reschedule_appointment') {
        // ... Handle reschedule logic
        messageToSend = "Como deseja reagendar?";
        // Simple placeholder for now
        nextState = AUTOMATION_STATES.COMPLETED;
      } else if (option_id === 'cancel_appointment') {
        // ... Handle cancel logic
        messageToSend = "Deseja realmente cancelar seu agendamento?";
        nextState = AUTOMATION_STATES.COMPLETED;
      }
      break;

    case AUTOMATION_STATES.AWAITING_CONFIRMATION_SCOPE:
      if (option_id === 'confirm_all') {
        await supabase.from("appointments").update({ status: 'confirmed' }).in("id", appointmentIds);
        messageToSend = "✅ Todos os seus agendamentos foram confirmados com sucesso!";
        nextState = AUTOMATION_STATES.COMPLETED;
        actionExecuted = "confirm_all";
      } else if (option_id === 'confirm_specific') {
        // List appointments
        const { data: appts } = await supabase.from("appointments").select("id, start_time, services(name)").in("id", appointmentIds);
        messageToSend = "Qual atendimento você deseja confirmar?";
        menuToSend = {
          list: {
            buttonLabel: "Ver atendimentos",
            title: "Selecione",
            options: appts.map((a: any) => ({
              id: `appointment_${a.id}`,
              title: `${formatBrazilTime(a.start_time)} - ${a.services?.name}`,
              description: `Confirmar apenas este atendimento`
            }))
          }
        };
        nextState = AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION;
        actionExecuted = "ask_specific_appointment";
      }
      break;

    case AUTOMATION_STATES.AWAITING_SPECIFIC_APPOINTMENT_SELECTION:
      if (option_id.startsWith('appointment_')) {
        const selectedId = option_id.replace('appointment_', '');
        await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", selectedId);
        
        const remainingIds = appointmentIds.filter((id: string) => id !== selectedId);
        
        if (remainingIds.length > 0) {
          messageToSend = "✅ Agendamento confirmado! O que deseja fazer com os demais agendamentos?";
          menuToSend = {
            list: {
              buttonLabel: "Ver opções",
              title: "Restantes",
              options: [
                { id: 'confirm_remaining', title: 'Confirmar', description: 'Confirmar os demais agendamentos' },
                { id: 'reschedule_remaining', title: 'Reagendar', description: 'Reagendar os demais agendamentos' },
                { id: 'cancel_remaining', title: 'Cancelar', description: 'Cancelar os demais agendamentos' }
              ]
            }
          };
          nextState = AUTOMATION_STATES.AWAITING_REMAINING_APPOINTMENT_ACTION;
          
          // Update conversation with remaining ids
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
  }

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
        // Handle each type
        if (automation.type === AUTOMATION_TYPES.CONFIRMATION) {
          const sentCount = await processConfirmationDispatch(supabase, tenant, automation, connection, appointmentId, forceMode);
          results.dispatches_sent += sentCount;
        } else if (automation.type === AUTOMATION_TYPES.REMINDER && !appointmentId) {
          // Reminders usually don't run on immediate appointment trigger
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
    // Immediate mode: fetch the specific appointment and its group
    const { data: specificAppt } = await supabase.from("appointments").select("appointment_group_id").eq("id", appointmentId).maybeSingle();
    if (specificAppt?.appointment_group_id) {
      query = query.eq("appointment_group_id", specificAppt.appointment_group_id);
    } else {
      query = query.eq("id", appointmentId);
    }
  } else {
    // Sweep mode: fetch new ones in last 15 mins
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    query = query.gte("created_at", fifteenMinsAgo);
  }

  const { data: appointments, error: apptError } = await query;

  if (apptError) {
    console.error(`[AutomationEngine] Error fetching appointments:`, apptError);
    return 0;
  }

  if (!appointments || appointments.length === 0) {
    console.log(`[AutomationEngine] No eligible appointments found for confirmation.`);
    return 0;
  }

  console.log(`[AutomationEngine] Found ${appointments.length} appointments for confirmation.`);

  // Group by customer and group_id
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
    
    if (!customer?.phone) {
      console.log(`[AutomationEngine] Customer has no phone. Appointment ID: ${firstAppt.id}`);
      continue;
    }

    const uniqueKey = `conf:${tenant.id}:${groupKey}`;
    
    // Check dispatch record
    if (!forceMode) {
      const { data: existing } = await supabase
        .from("automation_dispatches")
        .select("id")
        .eq("unique_key", uniqueKey)
        .maybeSingle();
      if (existing) {
        console.log(`[AutomationEngine] Confirmation already sent for group ${groupKey}. Skipping.`);
        continue;
      }
    }

    // Prepare message
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
            description: isMultiple ? 'Confirmar todos ou um específico' : 'Confirmar este atendimento' 
          },
          { id: 'reschedule_appointment', title: 'Reagendar', description: 'Alterar data ou horário' },
          { id: 'cancel_appointment', title: 'Cancelar', description: 'Cancelar atendimento' }
        ]
      }
    };

    console.log(`[AutomationEngine] Sending confirmation to ${customer.phone}`);
    const sendResult = await sendMessage(connection, customer.phone, message, menu);

    // Create Dispatch record
    await supabase.from("automation_dispatches").insert({
      tenant_id: tenant.id,
      automation_type: AUTOMATION_TYPES.CONFIRMATION,
      customer_id: customer.id,
      unique_key: uniqueKey,
      status: sendResult.success ? 'sent' : 'failed',
      sent_at: new Date().toISOString()
    });

    // Always log the attempt
    const { data: logData, error: logError } = await supabase.from("automation_logs").insert({
      tenant_id: tenant.id,
      automation_id: automation.id,
      customer_id: customer.id,
      appointment_id: firstAppt.id,
      phone: customer.phone,
      direction: 'outgoing',
      message_type: AUTOMATION_TYPES.CONFIRMATION,
      message: message,
      payload: menu,
      status: sendResult.success ? 'success' : 'error',
      error_message: sendResult.success ? null : sendResult.error,
      response: sendResult.response,
      sent_at: new Date().toISOString()
    }).select().single();

    if (sendResult.success) {
      sentCount++;
      // Create Conversation
      await supabase.from("automation_conversations").insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        phone: customer.phone,
        automation_type: AUTOMATION_TYPES.CONFIRMATION,
        appointment_ids: group.map(a => a.id),
        current_state: AUTOMATION_STATES.AWAITING_MAIN_ACTION,
        status: 'active'
      });

      // Update appointments
      await supabase.from("appointments").update({ confirmation_sent: true }).in("id", group.map(a => a.id));
    } else {
      console.error(`[AutomationEngine] Failed to send message to ${customer.phone}:`, sendResult.error);
    }
  }

  return sentCount;
}

async function processReminderDispatch(supabase: any, tenant: any, automation: any, connection: any, forceMode: boolean) {
  // Logic for reminders...
  return 0;
}
