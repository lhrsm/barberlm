import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, parse } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";
import { formatBrazilDate, formatBrazilTime } from "./utils.ts";
import { sendMessage } from "./whatsapp-settings.ts";

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
      } else if (option_id === 'cancel_appointment') {
        // ... Handle cancel logic
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

    // Add more cases for reschedule, cancel, etc.
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

export async function processAutomationDispatches(supabase: any, tenantId?: string) {
  // logic to process dispatches
}
