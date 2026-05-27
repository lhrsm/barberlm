import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";
import { getAvailableSlots } from "../_shared/availability.ts";
import { format, parse, addMinutes, isAfter } from "https://esm.sh/date-fns@2.30.0";
import { ptBR } from "https://esm.sh/date-fns@2.30.0/locale";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractSelectedOption(payload: any) {
  let text = "";
  let id = "";

  const possiblePaths = [
    payload.message?.listResponseMessage?.title,
    payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    payload.listResponseMessage?.title,
    payload.selectedRowId,
    payload.selectedId,
    payload.buttonReply?.id,
    payload.buttonReply?.title,
    payload.buttonsResponseMessage?.selectedButtonId,
    payload.buttonsResponseMessage?.selectedDisplayText,
    payload.message?.text,
    payload.text,
    payload.body,
    payload.optionListReply?.title,
    payload.optionListReply?.id
  ];

  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      text = val;
      break;
    }
  }

  id = payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
       payload.selectedRowId || 
       payload.selectedId || 
       payload.buttonReply?.id || 
       payload.buttonsResponseMessage?.selectedButtonId ||
       payload.optionListReply?.id || "";

  return {
    id: String(id || "").trim(),
    text: String(text || "").trim(),
    cleanText: removeAccents(String(text || "").trim().toLowerCase()),
    cleanId: removeAccents(String(id || "").trim().toLowerCase())
  };
}

async function logAutomationInteraction(
  supabase: any, 
  conversation: any, 
  message: string, 
  stateChange: { from: string, to: string }, 
  context: any,
  payload: any,
  response: any,
  error?: string
) {
  try {
    const { data: automation } = await supabase
      .from("automations")
      .select("id")
      .eq("tenant_id", conversation.barber_id)
      .eq("type", "appointment_confirmation")
      .maybeSingle();

    await supabase.from("automation_logs").insert({
      automation_id: automation?.id,
      tenant_id: conversation.barber_id,
      customer_id: conversation.customer_id,
      appointment_id: context?.selected_appointment_id || conversation.appointment_id,
      phone: conversation.phone,
      message_type: "appointment_confirmation_interaction",
      status: error ? "error" : "success",
      original_template: JSON.stringify(payload),
      processed_template: `From: ${stateChange.from} -> To: ${stateChange.to} | Action: ${context?.action || 'none'} | Scope: ${context?.scope || 'none'}`,
      response: { ...context, message, response_zapi: response },
      error_message: error,
      sent_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error logging interaction:", e);
  }
}

async function processZapiWebhook(body: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { instanceId, type, phone } = body;

  if (type === "Connected" || type === "Disconnected") {
    await supabase.from("whatsapp_instances").update({ status: type.toLowerCase(), connected: type === "Connected" }).eq("instance_id", instanceId);
    return;
  }

  if (type === "ReceivedMessage") {
    const normalizedPhone = normalizePhone(phone);
    const option = extractSelectedOption(body);
    const messageText = body.text?.message || body.message?.text || body.text || body.body || "";

    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("active", true)
      .maybeSingle();

    if (!conversation) return;

    const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
    if (!connection) return;

    const context = conversation.context || {};
    const state = conversation.state || 'awaiting_main_action';
    
    let nextState = state;
    let nextContext = { ...context };
    let nextMessage = "";
    let nextOptions: any = null;

    // 1. HELPERS
    const triggerNotification = async (appointmentId: string, notificationType: string) => {
      try {
        const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/appointment-notifications`;
        await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({
            appointmentId,
            type: notificationType,
            updatedBy: { type: 'customer', id: conversation.customer_id }
          })
        });
      } catch (e) {
        console.error("Error triggering notification:", e);
      }
    };

    const getAppointmentsFromConversation = async () => {
      console.log('GETTING APPOINTMENTS FOR CONVERSATION', conversation.id);
      if (!conversation.appointment_group_id && !conversation.appointment_id) {
        console.log('NO APPOINTMENT IDs IN CONVERSATION');
        return [];
      }
      
      let query = supabase
        .from("appointments")
        .select("*, services(name, duration), barbers(name)")
        .neq("status", "cancelled");
        
      if (conversation.appointment_group_id) {
        console.log('QUERYING BY GROUP ID:', conversation.appointment_group_id);
        query = query.eq("appointment_group_id", conversation.appointment_group_id);
      } else {
        console.log('QUERYING BY APPOINTMENT ID:', conversation.appointment_id);
        query = query.eq("id", conversation.appointment_id);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('ERROR FETCHING APPOINTMENTS:', error);
        return [];
      }
      return data || [];
    };

    const appointments = await getAppointmentsFromConversation();
    const isMultiple = appointments.length > 1;
    
    console.log('CONVERSATION', conversation);
    console.log('APPOINTMENTS FOUND', appointments);
    console.log('APPOINTMENTS COUNT', appointments.length);
    console.log('IS MULTIPLE', isMultiple);
    console.log('SELECTED OPTION', option);
    console.log('CURRENT STATE', state);
    console.log('CURRENT ACTION', context.action);

    // 2. STATE MACHINE
    try {
      switch (state) {
        case 'awaiting_main_action': {
          const action = (option.cleanId === 'main_confirm' || option.cleanId === 'confirmar' || option.cleanText.includes('confirmar')) ? 'confirm' :
                         (option.cleanId === 'main_reschedule' || option.cleanId === 'reagendar' || option.cleanText.includes('reagendar')) ? 'reschedule' :
                         (option.cleanId === 'main_cancel' || option.cleanId === 'cancelar' || option.cleanText.includes('cancelar')) ? 'cancel' : '';
          
          if (!action) {
            nextMessage = "Por favor, escolha uma opção:";
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: "Confirmação",
                options: [
                  { id: 'main_confirm', title: 'Confirmar Agendamento' },
                  { id: 'main_reschedule', title: 'Reagendar' },
                  { id: 'main_cancel', title: 'Cancelar' }
                ]
              }
            };
            break;
          }

          nextContext.action = action;
          
          if (!isMultiple) {
            nextContext.scope = 'single';
            const targetApptId = appointments[0]?.id || conversation.appointment_id;
            nextContext.selected_appointment_id = targetApptId;

            if (action === 'confirm') {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", targetApptId);
              await triggerNotification(targetApptId, 'appointment_confirmed');
              nextMessage = "✅ Seu agendamento foi confirmado com sucesso.";
              nextState = 'completed';
            } else if (action === 'reschedule') {
              nextState = 'awaiting_reschedule_date';
              nextMessage = `Para qual data você deseja reagendar o serviço de *${appointments[0].services?.name}*? (Ex: 25/05)`;
            } else if (action === 'cancel') {
              nextState = 'awaiting_cancel_confirmation';
              nextMessage = `Tem certeza que deseja cancelar o agendamento de *${appointments[0].services?.name}*?`;
              nextOptions = {
                buttons: [
                  { id: 'cancel_yes', label: 'Sim, cancelar' },
                  { id: 'cancel_no', label: 'Não, manter' }
                ]
              };
            }
          } else {
            nextState = action === 'confirm' ? 'awaiting_confirm_scope' : action === 'reschedule' ? 'awaiting_reschedule_scope' : 'awaiting_cancel_scope';
            nextMessage = `Você deseja ${action === 'confirm' ? 'confirmar' : action === 'reschedule' ? 'reagendar' : 'cancelar'} seus agendamentos:`;
            
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: "O que deseja fazer?",
                options: [
                  { id: action === 'confirm' ? 'confirm_all' : action === 'reschedule' ? 'reschedule_all' : 'cancel_all', title: action === 'confirm' ? 'Confirmar todos' : action === 'reschedule' ? 'Reagendar todos' : 'Cancelar todos' },
                  { id: action === 'confirm' ? 'confirm_single' : action === 'reschedule' ? 'reschedule_single' : 'cancel_single', title: action === 'confirm' ? 'Confirmar um específico' : action === 'reschedule' ? 'Reagendar um específico' : 'Cancelar um específico' }
                ]
              }
            };
          }
          console.log('NEXT STATE', nextState);
          break;
        }

        // --- CONFIRM FLOW (MULTIPLE) ---
        case 'awaiting_confirm_scope': {
          if (option.id === 'confirm_all') {
            for (const a of appointments) {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", a.id);
              await triggerNotification(a.id, 'appointment_confirmed');
            }
            nextMessage = "✅ Todos os seus agendamentos foram confirmados com sucesso.";
            nextState = 'completed';
          } else if (option.id === 'confirm_single') {
            nextState = 'awaiting_confirm_single_selection';
            nextMessage = "Qual atendimento você deseja confirmar?";
            nextOptions = {
              list: {
                buttonLabel: "Ver atendimentos",
                title: "Selecione",
                options: appointments.map(a => ({
                  id: a.id,
                  title: `${format(new Date(a.start_time), "HH:mm")} - ${a.services?.name}`,
                  description: `com ${a.barbers?.name}`
                }))
              }
            };
          } else {
            nextMessage = "Por favor, escolha se deseja confirmar todos ou um específico.";
          }
          break;
        }

        case 'awaiting_confirm_single_selection': {
          const appt = appointments.find(a => a.id === option.id);
          if (!appt) {
            nextMessage = "Por favor, selecione um agendamento da lista.";
            break;
          }
          await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", appt.id);
          await triggerNotification(appt.id, 'appointment_confirmed');
          nextContext.selected_appointment_id = appt.id;
          
          nextState = 'awaiting_remaining_after_confirm';
          nextMessage = `✅ Agendamento das ${format(new Date(appt.start_time), "HH:mm")} confirmado.\n\nO que deseja fazer com os outros agendamentos?`;
          nextOptions = {
            list: {
              buttonLabel: "Ver opções",
              title: "Outros agendamentos",
              options: [
                { id: 'remaining_reschedule', title: 'Reagendar', description: 'Reagendar os restantes' },
                { id: 'remaining_cancel', title: 'Cancelar', description: 'Cancelar os restantes' },
                { id: 'remaining_keep_pending', title: 'Manter pendente', description: 'Não alterar os demais' }
              ]
            }
          };
          break;
        }

        case 'awaiting_remaining_after_confirm': {
          const action = option.id === 'remaining_reschedule' ? 'reschedule' :
                         option.id === 'remaining_cancel' ? 'cancel' :
                         option.id === 'remaining_keep_pending' ? 'keep' : '';
          
          if (!action) {
            nextMessage = "Por favor, escolha o que fazer com os demais agendamentos.";
            break;
          }

          const remaining = appointments.filter(a => a.id !== nextContext.selected_appointment_id);
          if (action === 'reschedule') {
            nextContext.reschedule_queue = remaining.map(a => a.id);
            nextContext.current_reschedule_index = 0;
            const appt = appointments.find(a => a.id === nextContext.reschedule_queue[0]);
            nextState = 'awaiting_reschedule_date';
            nextMessage = `Certo. Vamos reagendar os demais. Para *${appt?.services?.name}*, qual a nova data? (Ex: 25/05)`;
          } else if (action === 'cancel') {
            nextContext.scope = 'remaining';
            nextState = 'awaiting_cancel_confirmation';
            nextMessage = "Tem certeza que deseja cancelar os demais agendamentos?";
            nextOptions = {
              buttons: [
                { id: 'cancel_yes', label: 'Sim, cancelar' },
                { id: 'cancel_no', label: 'Não, manter' }
              ]
            };
          } else {
            nextMessage = "✅ Certo. Os demais agendamentos permanecerão pendentes.";
            nextState = 'completed';
          }
          break;
        }

        // --- RESCHEDULE FLOW (MULTIPLE) ---
        case 'awaiting_reschedule_scope': {
          if (option.id === 'reschedule_all') {
            nextContext.scope = 'all';
            nextContext.reschedule_queue = appointments.map(a => a.id);
            nextContext.current_reschedule_index = 0;
            const appt = appointments.find(a => a.id === nextContext.reschedule_queue[0]);
            nextState = 'awaiting_reschedule_date';
            nextMessage = `Vamos reagendar todos. Começando por *${appt?.services?.name}*, qual a nova data? (Ex: 25/05)`;
          } else if (option.id === 'reschedule_single') {
            nextState = 'awaiting_reschedule_single_selection';
            nextMessage = "Qual atendimento você deseja reagendar?";
            nextOptions = {
              list: {
                buttonLabel: "Ver atendimentos",
                title: "Selecione",
                options: appointments.map(a => ({
                  id: a.id,
                  title: `${format(new Date(a.start_time), "HH:mm")} - ${a.services?.name}`,
                  description: `com ${a.barbers?.name}`
                }))
              }
            };
          } else {
            nextMessage = "Por favor, escolha se deseja reagendar todos ou um específico.";
          }
          break;
        }

        case 'awaiting_reschedule_single_selection': {
          const appt = appointments.find(a => a.id === option.id);
          if (!appt) {
            nextMessage = "Por favor, selecione um agendamento da lista.";
            break;
          }
          nextContext.selected_appointment_id = appt.id;
          nextContext.scope = 'single';
          nextState = 'awaiting_reschedule_date';
          nextMessage = `Para qual data deseja reagendar *${appt.services?.name}*? (Ex: 25/05)`;
          break;
        }

        // --- CANCEL FLOW (MULTIPLE) ---
        case 'awaiting_cancel_scope': {
          if (option.id === 'cancel_all') {
            nextContext.scope = 'all';
            nextState = 'awaiting_cancel_confirmation';
            nextMessage = "Tem certeza que deseja cancelar TODOS os seus agendamentos?";
            nextOptions = {
              buttons: [
                { id: 'cancel_yes', label: 'Sim, cancelar tudo' },
                { id: 'cancel_no', label: 'Não, manter todos' }
              ]
            };
          } else if (option.id === 'cancel_single') {
            nextState = 'awaiting_cancel_single_selection';
            nextMessage = "Qual atendimento você deseja cancelar?";
            nextOptions = {
              list: {
                buttonLabel: "Ver atendimentos",
                title: "Selecione",
                options: appointments.map(a => ({
                  id: a.id,
                  title: `${format(new Date(a.start_time), "HH:mm")} - ${a.services?.name}`,
                  description: `com ${a.barbers?.name}`
                }))
              }
            };
          } else {
            nextMessage = "Por favor, escolha se deseja cancelar todos ou um específico.";
          }
          break;
        }

        case 'awaiting_cancel_single_selection': {
          const appt = appointments.find(a => a.id === option.id);
          if (!appt) {
            nextMessage = "Por favor, selecione um agendamento da lista.";
            break;
          }
          nextContext.selected_appointment_id = appt.id;
          nextContext.scope = 'single';
          nextState = 'awaiting_cancel_confirmation';
          nextMessage = `Tem certeza que deseja cancelar *${appt.services?.name}*?`;
          nextOptions = {
            buttons: [
              { id: 'cancel_yes', label: 'Sim, cancelar' },
              { id: 'cancel_no', label: 'Não, manter' }
            ]
          };
          break;
        }

        // --- COMMON FLOWS (DATE, TIME, CANCEL CONFIRM, REFUND) ---
        case 'awaiting_cancel_confirmation': {
          const isYes = option.cleanId === 'cancel_yes' || option.cleanText.includes('sim');
          if (isYes) {
            const scope = nextContext.scope || 'single';
            const toCancel = scope === 'all' ? appointments : 
                             scope === 'remaining' ? appointments.filter(a => a.id !== nextContext.selected_appointment_id) :
                             appointments.filter(a => a.id === nextContext.selected_appointment_id);
            
            const hasPaid = toCancel.some(a => a.payment_status === 'paid' || a.payment_status === 'completed');
            if (hasPaid) {
              nextState = 'awaiting_refund_preference';
              nextMessage = "Identificamos que há agendamento pago. Como deseja receber o valor?";
              nextOptions = {
                list: {
                  buttonLabel: "Escolher",
                  title: "Estorno/Crédito",
                  options: [
                    { id: 'refund_money', title: 'Estorno', description: 'Receber o valor de volta' },
                    { id: 'refund_credit', title: 'Créditos', description: 'Converter em créditos na barbearia' }
                  ]
                }
              };
            } else {
              for (const a of toCancel) {
                await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", a.id);
                await triggerNotification(a.id, 'appointment_cancelled');
              }
              nextMessage = "❌ Cancelamento realizado com sucesso.";
              
              if (scope === 'single' && isMultiple) {
                nextState = 'awaiting_remaining_after_cancel';
                nextMessage += "\n\nO que deseja fazer com os outros agendamentos?";
                nextOptions = {
                  list: {
                    buttonLabel: "Ver opções",
                    title: "Outros agendamentos",
                    options: [
                      { id: 'remaining_confirm', title: 'Confirmar', description: 'Confirmar os restantes' },
                      { id: 'remaining_reschedule', title: 'Reagendar', description: 'Reagendar os restantes' },
                      { id: 'remaining_keep_pending', title: 'Manter pendente', description: 'Não alterar os demais' }
                    ]
                  }
                };
              } else {
                nextState = 'completed';
              }
            }
          } else {
            nextMessage = "✅ Agendamento mantido.";
            nextState = 'completed';
          }
          break;
        }

        case 'awaiting_refund_preference': {
          const preference = option.id === 'refund_money' ? 'refund' : option.id === 'refund_credit' ? 'credit' : '';
          if (!preference) {
             nextMessage = "Por favor, escolha como deseja receber o valor (Estorno ou Créditos).";
             break;
          }
          
          const scope = nextContext.scope || 'single';
          const toCancel = scope === 'all' ? appointments : 
                           scope === 'remaining' ? appointments.filter(a => a.id !== nextContext.selected_appointment_id) :
                           appointments.filter(a => a.id === nextContext.selected_appointment_id);

          for (const a of toCancel) {
            await supabase.from("appointments").update({ status: 'cancelled', refund_status: 'requested', refund_type: preference }).eq("id", a.id);
            await triggerNotification(a.id, 'appointment_cancelled');
            
            if (preference === 'credit') {
              const { data: wallet } = await supabase.from("wallet").select("*").eq("customer_id", conversation.customer_id).maybeSingle();
              const amount = Number(a.total_price || 0);
              if (wallet) {
                await supabase.from("wallet").update({ balance: Number(wallet.balance) + amount }).eq("id", wallet.id);
              } else {
                await supabase.from("wallet").insert({ customer_id: conversation.customer_id, balance: amount, user_id: conversation.barber_id });
              }
            }
          }

          nextMessage = preference === 'refund' ? "✅ Cancelamento solicitado. A barbearia irá processar seu estorno." : "✅ Seu agendamento foi cancelado e o valor foi convertido em créditos.";
          
          if (scope === 'single' && isMultiple) {
            nextState = 'awaiting_remaining_after_cancel';
            nextMessage += "\n\nO que deseja fazer com os outros agendamentos?";
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: "Outros agendamentos",
                options: [
                  { id: 'remaining_confirm', title: 'Confirmar', description: 'Confirmar os restantes' },
                  { id: 'remaining_reschedule', title: 'Reagendar', description: 'Reagendar os restantes' },
                  { id: 'remaining_keep_pending', title: 'Manter pendente', description: 'Não alterar os demais' }
                ]
              }
            };
          } else {
            nextState = 'completed';
          }
          break;
        }

        case 'awaiting_remaining_after_cancel': {
          const action = option.id === 'remaining_confirm' ? 'confirm' :
                         option.id === 'remaining_reschedule' ? 'reschedule' :
                         option.id === 'remaining_keep_pending' ? 'keep' : '';
          
          if (!action) {
            nextMessage = "Por favor, escolha o que fazer com os demais agendamentos.";
            break;
          }

          const remaining = appointments.filter(a => a.id !== nextContext.selected_appointment_id);
          if (action === 'confirm') {
            for (const a of remaining) {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", a.id);
              await triggerNotification(a.id, 'appointment_confirmed');
            }
            nextMessage = "✅ Todos os agendamentos foram confirmados.";
            nextState = 'completed';
          } else if (action === 'reschedule') {
            nextContext.reschedule_queue = remaining.map(a => a.id);
            nextContext.current_reschedule_index = 0;
            const appt = appointments.find(a => a.id === nextContext.reschedule_queue[0]);
            nextState = 'awaiting_reschedule_date';
            nextMessage = `Certo. Vamos reagendar os demais. Para *${appt?.services?.name}*, qual a nova data?`;
          } else {
            nextMessage = "✅ Certo. Os demais agendamentos permanecerão pendentes.";
            nextState = 'completed';
          }
          break;
        }

        case 'awaiting_reschedule_date': {
          let targetDate = "";
          const now = new Date();
          const cleanText = removeAccents(messageText.toLowerCase());
          
          if (cleanText.includes('hoje')) targetDate = format(now, "yyyy-MM-dd");
          else if (cleanText.includes('amanha')) targetDate = format(new Date(now.getTime() + 86400000), "yyyy-MM-dd");
          else {
            const match = messageText.match(/(\d{1,2})\/(\d{1,2})/);
            if (match) targetDate = `${now.getFullYear()}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          }

          if (!targetDate) {
            nextMessage = "Não entendi a data. Por favor, envie no formato DD/MM (Ex: 25/05) ou escreva 'Amanhã'.";
            break;
          }

          const currentApptId = nextContext.scope === 'all' ? nextContext.reschedule_queue[nextContext.current_reschedule_index] : nextContext.selected_appointment_id;
          const appt = appointments.find(a => a.id === currentApptId);
          const slots = await getAvailableSlots(supabase, appt?.barber_id, targetDate, appt?.services?.duration || 30);

          if (slots.length === 0) {
            nextMessage = `Não há horários disponíveis para o dia ${formatBrazilDate(targetDate)}. Por favor, escolha outra data.`;
            break;
          }

          nextContext.target_date = targetDate;
          nextState = 'awaiting_reschedule_time';
          nextMessage = `Horários disponíveis para ${formatBrazilDate(targetDate)}:`;
          nextOptions = {
            list: {
              buttonLabel: "Escolher horário",
              title: "Horários",
              options: slots.slice(0, 10).map(s => ({ id: `time_${s}`, title: s }))
            }
          };
          break;
        }

        case 'awaiting_reschedule_time': {
          const selectedTime = option.id.startsWith('time_') ? option.id.replace('time_', '') : messageText.trim();
          if (!/^\d{2}:\d{2}$/.test(selectedTime)) {
            nextMessage = "Por favor, selecione um horário da lista.";
            break;
          }

          const currentApptId = nextContext.scope === 'all' ? nextContext.reschedule_queue[nextContext.current_reschedule_index] : nextContext.selected_appointment_id;
          const appt = appointments.find(a => a.id === currentApptId);
          const startStr = `${nextContext.target_date}T${selectedTime}:00`;
          const endStr = format(addMinutes(new Date(startStr), appt?.services?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");

          await supabase.from("appointments").update({ start_time: startStr, end_time: endStr, status: 'confirmed' }).eq("id", currentApptId);
          await triggerNotification(currentApptId, 'appointment_rescheduled');

          if (nextContext.scope === 'all' && nextContext.current_reschedule_index < nextContext.reschedule_queue.length - 1) {
            nextContext.current_reschedule_index++;
            const nextApptId = nextContext.reschedule_queue[nextContext.current_reschedule_index];
            const nextAppt = appointments.find(a => a.id === nextApptId);
            nextState = 'awaiting_reschedule_date';
            nextMessage = `✅ Reagendado.\n\nPróximo: *${nextAppt?.services?.name}*. Qual a nova data?`;
          } else {
            nextMessage = "✅ Seu agendamento foi reagendado com sucesso.";
            if (nextContext.scope === 'single' && isMultiple) {
              nextState = 'awaiting_remaining_after_reschedule';
              nextMessage += "\n\nO que deseja fazer com os outros agendamentos?";
              nextOptions = {
                list: {
                  buttonLabel: "Ver opções",
                  title: "Outros agendamentos",
                  options: [
                    { id: 'remaining_confirm', title: 'Confirmar', description: 'Confirmar os restantes' },
                    { id: 'remaining_cancel', title: 'Cancelar', description: 'Cancelar os restantes' },
                    { id: 'remaining_keep_pending', title: 'Manter pendente', description: 'Não alterar os demais' }
                  ]
                }
              };
            } else {
              nextState = 'completed';
            }
          }
          break;
        }

        case 'awaiting_remaining_after_reschedule': {
          const action = option.id === 'remaining_confirm' ? 'confirm' :
                         option.id === 'remaining_cancel' ? 'cancel' :
                         option.id === 'remaining_keep_pending' ? 'keep' : '';
          
          if (!action) {
            nextMessage = "Por favor, escolha o que fazer com os demais agendamentos.";
            break;
          }

          const remaining = appointments.filter(a => a.id !== nextContext.selected_appointment_id);
          if (action === 'confirm') {
            for (const a of remaining) {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", a.id);
              await triggerNotification(a.id, 'appointment_confirmed');
            }
            nextMessage = "✅ Todos os agendamentos foram confirmados.";
            nextState = 'completed';
          } else if (action === 'cancel') {
            nextContext.scope = 'remaining';
            nextState = 'awaiting_cancel_confirmation';
            nextMessage = "Tem certeza que deseja cancelar os demais agendamentos?";
            nextOptions = {
              buttons: [
                { id: 'cancel_yes', label: 'Sim, cancelar' },
                { id: 'cancel_no', label: 'Não, manter' }
              ]
            };
          } else {
            nextMessage = "✅ Certo. Os demais agendamentos permanecerão pendentes.";
            nextState = 'completed';
          }
          break;
        }
      }
      console.log('NEXT STATE', nextState);
    } catch (e) {
      console.error("STATE MACHINE ERROR:", e);
      nextMessage = "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.";
    }

    // 3. FINALIZATION
    if (nextState === 'completed') {
      await supabase.from("whatsapp_conversations").update({ active: false, state: 'completed', context: nextContext }).eq("id", conversation.id);
    } else {
      await supabase.from("whatsapp_conversations").update({ state: nextState, context: nextContext }).eq("id", conversation.id);
    }

    if (nextMessage) {
      const response = await sendMessage(connection, normalizedPhone, nextMessage, nextOptions);
      await logAutomationInteraction(supabase, conversation, nextMessage, { from: state, to: nextState }, nextContext, body, response);
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    processZapiWebhook(body); 
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
