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
  extraContext: any,
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
      appointment_id: extraContext?.selected_appointment_id || conversation.appointment_id,
      phone: conversation.phone,
      message_type: "appointment_confirmation_interaction",
      status: error ? "error" : "success",
      original_template: JSON.stringify(payload),
      processed_template: `From: ${stateChange.from} -> To: ${stateChange.to} | Action: ${extraContext?.action || 'none'} | Scope: ${extraContext?.scope || 'none'}`,
      response: { ...extraContext, message },
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
    const triggerNotification = async (appointmentId: string, type: string) => {
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
            type,
            updatedBy: { type: 'customer', id: conversation.customer_id }
          })
        });
      } catch (e) {
        console.error("Error triggering notification:", e);
      }
    };

    const finishConversation = async (message: string) => {
      const res = await sendMessage(connection, normalizedPhone, message);
      console.log('FINISH CONVERSATION RESULT', JSON.stringify(res));
      await supabase.from("whatsapp_conversations").update({ active: false, state: 'completed' }).eq("id", conversation.id);
      return res;
    };

    const listAppointments = (appointments: any[]) => {
      return appointments.map((a, i) => {
        const time = format(new Date(a.start_time), "HH:mm");
        return `${i + 1}️⃣ ${time} - ${a.service_name} com ${a.barber_name}`;
      }).join('\n');
    };

    const listAppointmentsOptions = (appointments: any[]) => {
      return appointments.map((a, i) => {
        const time = format(new Date(a.start_time), "HH:mm");
        return {
          id: `appt_${a.id}`,
          title: `${time} - ${a.service_name}`,
          description: `com ${a.barber_name}`
        };
      });
    };

    // 2. STATE MACHINE
    try {
      switch (state) {
        case 'awaiting_main_action': {
          if (option.cleanId === 'confirm' || option.cleanId === 'confirm_appointment' || option.cleanText.includes('confirmar')) {
            nextContext.action = 'confirm';
            nextState = 'awaiting_scope_selection';
            
            const actionLabel = 'Confirmar';
            const descriptionAction = 'confirmar';
            
            nextMessage = `O que você deseja ${descriptionAction}?`;
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: actionLabel + " agendamento",
                options: [
                  { id: 'all', title: 'Todos os agendamentos', description: `Confirmar todos os atendimentos deste pedido` },
                  { id: 'single', title: 'Um agendamento específico', description: `Escolher qual atendimento deseja ${descriptionAction}` }
                ]
              }
            };
          } else if (option.cleanId === 'reschedule' || option.cleanId === 'reschedule_appointment' || option.cleanText.includes('reagendar')) {
            nextContext.action = 'reschedule';
            nextState = 'awaiting_scope_selection';
            
            const actionLabel = 'Reagendar';
            const descriptionAction = 'reagendar';
            
            nextMessage = `O que você deseja ${descriptionAction}?`;
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: actionLabel + " agendamento",
                options: [
                  { id: 'all', title: 'Todos os agendamentos', description: `Confirmar todos os atendimentos deste pedido` },
                  { id: 'single', title: 'Um agendamento específico', description: `Escolher qual atendimento deseja ${descriptionAction}` }
                ]
              }
            };
          } else if (option.cleanId === 'cancel' || option.cleanId === 'cancel_appointment' || option.cleanText.includes('cancelar')) {
            nextContext.action = 'cancel';
            nextState = 'awaiting_scope_selection';
            
            const actionLabel = 'Cancelar';
            const descriptionAction = 'cancelar';
            
            nextMessage = `O que você deseja ${descriptionAction}?`;
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: actionLabel + " agendamento",
                options: [
                  { id: 'all', title: 'Todos os agendamentos', description: `Confirmar todos os atendimentos deste pedido` },
                  { id: 'single', title: 'Um agendamento específico', description: `Escolher qual atendimento deseja ${descriptionAction}` }
                ]
              }
            };
          } else {
            nextMessage = `Não consegui entender sua escolha. Responda:\n\n1️⃣ Confirmar\n2️⃣ Reagendar\n3️⃣ Cancelar`;
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: "Opções disponíveis",
                options: [
                  { id: 'confirm', title: 'Confirmar agendamento', description: 'Confirmar todos ou um atendimento específico' },
                  { id: 'reschedule', title: 'Reagendar', description: 'Alterar data ou horário do atendimento' },
                  { id: 'cancel', title: 'Cancelar', description: 'Cancelar todos ou um atendimento específico' }
                ]
              }
            };
          }
          break;
        }

        case 'awaiting_scope_selection': {
          if (option.cleanId === 'all') {
            nextContext.scope = 'all';
            const appointments = context.appointments || [];
            
            if (nextContext.action === 'confirm') {
              for (const appt of appointments) {
                await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", appt.id);
                await triggerNotification(appt.id, 'appointment_confirmed');
              }
              nextMessage = `✅ Todos os seus agendamentos foram confirmados com sucesso!`;
            } else if (nextContext.action === 'cancel') {
              nextState = 'awaiting_cancel_confirmation';
              nextMessage = `Tem certeza que deseja cancelar TODOS os seus agendamentos?`;
              nextOptions = {
                buttons: [
                  { id: 'all', label: 'Sim, cancelar tudo' },
                  { id: 'keep', label: 'Não, manter todos' }
                ]
              };
            } else if (nextContext.action === 'reschedule') {
              nextContext.reschedule_queue = appointments.map(a => a.id);
              nextContext.current_reschedule_index = 0;
              const currentApptId = nextContext.reschedule_queue[0];
              const appt = appointments.find(a => a.id === currentApptId);
              
              nextState = 'awaiting_reschedule_date';
              nextMessage = `Vamos reagendar seus atendimentos um por um.\n\nPara o serviço de *${appt.service_name}*, qual a nova data desejada? (Ex: Hoje, Amanhã, ou uma data como 25/05)`;
            }
          } else if (option.cleanId === 'single') {
            nextContext.scope = 'single';
            nextState = 'awaiting_single_appointment_selection';
            const actionLabel = nextContext.action === 'confirm' ? 'confirmar' : nextContext.action === 'reschedule' ? 'reagendar' : 'cancelar';
            const titleAction = nextContext.action === 'confirm' ? 'Confirmar' : nextContext.action === 'reschedule' ? 'Reagendar' : 'Cancelar';
            
            nextMessage = `Qual agendamento você deseja ${actionLabel}?`;
            nextOptions = {
              list: {
                buttonLabel: "Escolher agendamento",
                title: titleAction + " específico",
                options: listAppointmentsOptions(context.appointments)
              }
            };
          } else {
            const actionLabel = nextContext.action === 'confirm' ? 'confirmar' : nextContext.action === 'reschedule' ? 'reagendar' : 'cancelar';
            const titleAction = nextContext.action === 'confirm' ? 'Confirmar' : nextContext.action === 'reschedule' ? 'Reagendar' : 'Cancelar';
            nextMessage = `Por favor, escolha uma opção para ${actionLabel}:`;
            nextOptions = {
              list: {
                buttonLabel: "Ver opções",
                title: titleAction + " agendamento",
                options: [
                  { id: 'all', title: 'Todos os agendamentos', description: `Confirmar todos os atendimentos deste pedido` },
                  { id: 'single', title: 'Um agendamento específico', description: `Escolher qual atendimento deseja ${actionLabel}` }
                ]
              }
            };
          }
          break;
        }

        case 'awaiting_single_appointment_selection': {
          const appointments = context.appointments || [];
          let selectedAppt = null;

          if (option.cleanId.startsWith('appt_')) {
            const apptId = option.cleanId.replace('appt_', '');
            selectedAppt = appointments.find(a => a.id === apptId);
          } else {
            const index = parseInt(messageText.replace(/\D/g, '')) - 1;
            if (!isNaN(index) && index >= 0 && index < appointments.length) {
              selectedAppt = appointments[index];
            }
          }

          if (!selectedAppt) {
            const actionLabel = nextContext.action === 'confirm' ? 'confirmar' : nextContext.action === 'reschedule' ? 'reagendar' : 'cancelar';
            const titleAction = nextContext.action === 'confirm' ? 'Confirmar' : nextContext.action === 'reschedule' ? 'Reagendar' : 'Cancelar';
            nextMessage = `Opção inválida. Qual agendamento você deseja ${actionLabel}?`;
            nextOptions = {
              list: {
                buttonLabel: "Escolher agendamento",
                title: titleAction + " específico",
                options: listAppointmentsOptions(appointments)
              }
            };
            return;
          }

          nextContext.selected_appointment_id = selectedAppt.id;

          if (nextContext.action === 'confirm') {
            await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", selectedAppt.id);
            await triggerNotification(selectedAppt.id, 'appointment_confirmed');
            
            const time = format(new Date(selectedAppt.start_time), "HH:mm");
            nextMessage = `✅ O agendamento das ${time} (${selectedAppt.service_name}) foi confirmado com sucesso!`;
          } else if (nextContext.action === 'cancel') {
            nextState = 'awaiting_cancel_confirmation';
            nextMessage = `Tem certeza que deseja cancelar o agendamento de *${selectedAppt.service_name}*?`;
            nextOptions = {
              buttons: [
                { id: '1', label: 'Sim, cancelar' },
                { id: '2', label: 'Não, manter' }
              ]
            };
          } else if (nextContext.action === 'reschedule') {
            nextState = 'awaiting_reschedule_date';
            nextMessage = `Para qual data você deseja reagendar o serviço de *${selectedAppt.service_name}*? (Ex: 25/05)`;
          }
          break;
        }

        case 'awaiting_cancel_confirmation': {
          const isYes = ['1', '1️⃣', 'sim', 'cancelar', 'yes', 'cancel', 'all'].some(s => option.cleanId === s || messageText.toLowerCase().includes(s));
          if (isYes) {
            if (nextContext.scope === 'all') {
              for (const appt of context.appointments) {
                await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", appt.id);
                await triggerNotification(appt.id, 'appointment_cancelled');
              }
              nextMessage = `❌ Todos os seus agendamentos foram cancelados com sucesso.`;
            } else {
              const apptId = nextContext.selected_appointment_id || conversation.appointment_id;
              await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", apptId);
              await triggerNotification(apptId, 'appointment_cancelled');
              nextMessage = `❌ Seu agendamento foi cancelado com sucesso.`;
            }
          } else {
            nextMessage = `Ufa! Agendamento mantido. ✅ Se precisar de algo mais, estamos à disposição.`;
          }
          break;
        }

        case 'awaiting_reschedule_date': {
          let targetDate = "";
          const now = new Date();
          const cleanText = removeAccents(messageText.toLowerCase());
          
          if (cleanText.includes('hoje')) {
            targetDate = format(now, "yyyy-MM-dd");
          } else if (cleanText.includes('amanha')) {
            targetDate = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");
          } else {
            const dateMatch = messageText.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const day = dateMatch[1].padStart(2, '0');
              const month = dateMatch[2].padStart(2, '0');
              const year = now.getFullYear();
              targetDate = `${year}-${month}-${day}`;
            }
          }

          if (targetDate) {
            nextContext.new_date = targetDate;
            const slots = await getAvailableSlots(supabase, conversation.barber_id, targetDate);
            if (slots.length > 0) {
              nextState = 'awaiting_reschedule_time';
              const formattedDate = format(parse(targetDate, "yyyy-MM-dd", new Date()), "dd/MM");
              nextMessage = `Ótimo! Para o dia ${formattedDate}, temos estes horários disponíveis:\n\n${slots.slice(0, 10).join('\n')}\n\nQual horário você prefere? (Ex: 14:30)`;
            } else {
              nextMessage = `Infelizmente não temos horários disponíveis para esta data. Por favor, escolha outra data:`;
            }
          } else {
            nextMessage = `Não consegui entender a data. Por favor, informe no formato DD/MM ou diga "Amanhã":`;
          }
          break;
        }

        case 'awaiting_reschedule_time': {
          const timeMatch = messageText.match(/(\d{2}):(\d{2})/);
          if (timeMatch) {
            const newTime = timeMatch[0];
            const newStart = `${nextContext.new_date}T${newTime}:00`;
            const apptId = nextContext.selected_appointment_id || conversation.appointment_id;

            const { data: appt } = await supabase.from("appointments").select("duration").eq("id", apptId).single();
            const duration = appt?.duration || 30;
            const newEnd = format(addMinutes(parse(newStart, "yyyy-MM-dd'T'HH:mm:ss", new Date()), duration), "yyyy-MM-dd'T'HH:mm:ss");

            await supabase.from("appointments").update({
              start_time: newStart,
              end_time: newEnd,
              status: 'pending'
            }).eq("id", apptId);

            await triggerNotification(apptId, 'appointment_rescheduled');

            if (nextContext.reschedule_queue && nextContext.current_reschedule_index < nextContext.reschedule_queue.length - 1) {
              nextContext.current_reschedule_index++;
              const nextApptId = nextContext.reschedule_queue[nextContext.current_reschedule_index];
              const nextAppt = context.appointments.find(a => a.id === nextApptId);
              nextContext.selected_appointment_id = nextApptId;
              nextState = 'awaiting_reschedule_date';
              nextMessage = `✅ Reagendado!\n\nAgora para o serviço de *${nextAppt.service_name}*, qual a nova data desejada?`;
            } else {
              nextMessage = `✅ Tudo pronto! Seu agendamento foi reagendado para ${format(parse(newStart, "yyyy-MM-dd'T'HH:mm:ss", new Date()), "dd/MM 'às' HH:mm")}.`;
            }
          } else {
            nextMessage = `Por favor, informe o horário no formato HH:MM (ex: 14:30):`;
          }
          break;
        }
      }

      console.log('NEXT STATE', nextState);

      // Update conversation state
      await supabase.from("whatsapp_conversations").update({
        state: nextState,
        context: nextContext,
        updated_at: new Date().toISOString()
      }).eq("id", conversation.id);

      // Log interaction
      await logAutomationInteraction(supabase, conversation, messageText, { from: state, to: nextState }, nextContext, body, nextMessage, undefined);

    } catch (error) {
      console.error('ERROR IN STATE MACHINE', error);
      await logAutomationInteraction(supabase, conversation, messageText, { from: state, to: nextState }, nextContext, body, null, error.message);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('WEBHOOK RECEIVED');
    console.log('RAW PAYLOAD', JSON.stringify(body));

    // Process asynchronously to avoid Z-API timeout and "loading" state
    processZapiWebhook(body).catch(err => {
      console.error("Webhook async error:", err);
    });

    // Return 200 OK immediately
    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 
    });
  } catch (err) {
    console.error("Error in webhook serve:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500 
    });
  }
});
