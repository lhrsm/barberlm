
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

function extractSelectedOption(payload: any): string {
  let text = "";
  let id = "";

  // Check all possible paths provided by the user
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

  // Also check if any of these are the primary source of ID
  id = payload.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
       payload.selectedRowId || 
       payload.selectedId || 
       payload.buttonReply?.id || 
       payload.buttonsResponseMessage?.selectedButtonId ||
       payload.optionListReply?.id || "";

  const cleanText = removeAccents(String(text || "").trim().toLowerCase());
  const cleanId = removeAccents(String(id || "").trim().toLowerCase());

  console.log('EXTRACTION - Clean Text:', cleanText);
  console.log('EXTRACTION - Clean ID:', cleanId);

  // Mappings
  const confirmPatterns = ['confirmar agendamento', 'confirmar', 'confirm', '1', 'confirm_appointment', 'confirmar_agendamento', '1️⃣'];
  const reschedulePatterns = ['reagendar', 'reschedule', '2', 'reschedule_appointment', '2️⃣'];
  const cancelPatterns = ['cancelar', 'cancel', '3', 'cancel_appointment', '3️⃣'];
  const allPatterns = ['todos', 'all', '1', '1️⃣'];
  const singlePatterns = ['apenas um específico', 'apenas um', 'especifico', 'single', '2', '2️⃣'];

  if (confirmPatterns.includes(cleanId) || confirmPatterns.includes(cleanText)) return 'confirm';
  if (reschedulePatterns.includes(cleanId) || reschedulePatterns.includes(cleanText)) return 'reschedule';
  if (cancelPatterns.includes(cleanId) || cancelPatterns.includes(cleanText)) return 'cancel';
  if (allPatterns.includes(cleanId) || allPatterns.includes(cleanText)) return 'all';
  if (singlePatterns.includes(cleanId) || singlePatterns.includes(cleanText)) return 'single';

  // Fallback fuzzy
  if (cleanText.includes('confirmar')) return 'confirm';
  if (cleanText.includes('reagendar')) return 'reschedule';
  if (cleanText.includes('cancelar')) return 'cancel';
  if (cleanText.includes('todos')) return 'all';
  if (cleanText.includes('apenas um') || cleanText.includes('especifico')) return 'single';

  return "";
}


async function logAutomationInteraction(supabase: any, conversation: any, message: string, stateChange: { from: string, to: string }, action?: string, payload?: any, response?: any, error?: string) {
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
      appointment_id: conversation.appointment_id,
      phone: conversation.phone,
      message_type: "appointment_confirmation_interaction",
      status: error ? "error" : "success",
      original_template: message,
      processed_template: `State: ${stateChange.from} -> ${stateChange.to} | Action: ${action || 'none'}`,
      response: response,
      error_message: error,
      sent_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error logging interaction:", e);
  }
}

async function processWebhook(body: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("Z-API Webhook Processing:", JSON.stringify(body));

  const { instanceId, type, phone } = body;

  if (type === "Connected" || type === "Disconnected") {
    const status = type.toLowerCase();
    await supabase.from("whatsapp_instances").update({ status, connected: type === "Connected" }).eq("instance_id", instanceId);
    return;
  }

  if (type === "ReceivedMessage") {
    const normalizedPhone = normalizePhone(phone);
    const { option, text: messageText, id: responseActionId } = extractIncomingOption(body);

    console.log('ZAPI WEBHOOK RAW PAYLOAD', JSON.stringify(body));
    console.log('EXTRACTED OPTION', option);
    console.log('PHONE', phone);

    if (!messageText && !responseActionId) {
      console.log("No text or action ID in message");
      return;
    }

    // Find active conversation
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (convError || !conversation) {
      console.log("No active conversation for", normalizedPhone, convError);
      return;
    }

    console.log('CONVERSATION FOUND', JSON.stringify(conversation));
    console.log('CURRENT STATE', conversation.state);

    const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
    if (!connection) {
      console.log("No Z-API settings for barber", conversation.barber_id);
      return;
    }

    const context = conversation.context || {};
    const state = conversation.state;
    let nextState = state;
    let nextContext = { ...context };

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
      console.log('ZAPI SEND RESPONSE (Finish)', JSON.stringify(res));
      await supabase.from("whatsapp_conversations").update({ active: false, state: 'completed' }).eq("id", conversation.id);
    };

    const listAppointments = (appointments: any[]) => {
      return appointments.map((a, i) => {
        const date = format(new Date(a.start_time), "dd/MM");
        const time = format(new Date(a.start_time), "HH:mm");
        return `${i + 1}️⃣ ${time} - ${a.service_name} com ${a.barber_name}`;
      }).join('\n');
    };

    // 2. STATE MACHINE
    switch (state) {
      case 'awaiting_main_action': {
        console.log(`[Webhook] Processing action for ${normalizedPhone}. Option: "${option}"`);
        
        if (option === 'confirm' || option === 'reschedule' || option === 'cancel') {
          nextContext.action = option;
        } else {
          console.log('[Webhook] No match for action. Sending invalid option message.');
          const res = await sendMessage(connection, normalizedPhone, `Desculpe, não entendi.\n\nPor favor, escolha uma opção:`, {
            list: {
              buttonLabel: "Ver opções",
              title: "Opções disponíveis",
              options: [
                { id: 'confirm', title: 'Confirmar agendamento', description: 'Confirmar todos ou um atendimento específico' },
                { id: 'reschedule', title: 'Reagendar', description: 'Alterar data ou horário do atendimento' },
                { id: 'cancel', title: 'Cancelar', description: 'Cancelar todos ou um atendimento específico' }
              ]
            }
          });
          console.log('ZAPI SEND RESPONSE (Invalid Option)', JSON.stringify(res));
          return;
        }

        // If multiple appointments, ask for scope
        if (context.appointments && context.appointments.length > 1) {
          nextState = 'awaiting_scope_selection';
          const actionLabel = nextContext.action === 'confirm' ? 'confirmar' : nextContext.action === 'reschedule' ? 'reagendar' : 'cancelar';
          
          console.log(`[Webhook] Sending scope selection message for ${nextContext.action}`);
          const res = await sendMessage(connection, normalizedPhone, `Você deseja ${actionLabel}:\n\n1️⃣ Todos os agendamentos\n2️⃣ Apenas um específico`, {
            buttons: [
              { id: 'all', label: 'Todos' },
              { id: 'single', label: 'Apenas um' }
            ],
            title: "Escolha o que deseja " + actionLabel
          });
          console.log('BUTTONS SEND RESULT', JSON.stringify(res));
        } else {
          // Single appointment flow
          const apptId = context.appointments?.[0]?.id || conversation.appointment_id;
          nextContext.selected_appointment_id = apptId;
          
          if (nextContext.action === 'confirm') {
            await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", apptId);
            await triggerNotification(apptId, 'appointment_confirmed');
            await finishConversation(`✅ Agendamento confirmado com sucesso! Esperamos você na ${context.business_name || 'barbearia'}.`);
            return;
          } else if (nextContext.action === 'cancel') {
            nextState = 'awaiting_cancel_confirmation';
            const res = await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar seu agendamento?`, {
              buttons: [
                { id: '1', label: 'Sim, cancelar' },
                { id: '2', label: 'Não, manter' }
              ]
            });
            console.log('ZAPI SEND RESPONSE (Cancel Confirm)', JSON.stringify(res));
          } else if (nextContext.action === 'reschedule') {
            nextState = 'awaiting_reschedule_date';
            const res = await sendMessage(connection, normalizedPhone, `Para qual data você deseja reagendar? (Ex: Hoje, Amanhã, ou uma data como 25/05)`);
            console.log('ZAPI SEND RESPONSE (Reschedule Date)', JSON.stringify(res));
          }
        }
        break;
      }

      case 'awaiting_scope_selection': {
        if (option === 'all') {
          console.log('[Webhook] Matched scope: ALL');
          nextContext.scope = 'all';
          const appointments = context.appointments || [];
          
          if (context.action === 'confirm') {
            for (const appt of appointments) {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", appt.id);
              await triggerNotification(appt.id, 'appointment_confirmed');
            }
            await finishConversation(`✅ Todos os seus agendamentos foram confirmados com sucesso!`);
            return;
          } else if (context.action === 'cancel') {
            nextState = 'awaiting_cancel_confirmation';
            const res = await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar TODOS os seus agendamentos?`, {
              buttons: [
                { id: 'all', label: 'Sim, cancelar tudo' },
                { id: 'keep', label: 'Não, manter todos' }
              ]
            });
            console.log('ZAPI SEND RESPONSE (Cancel Scope Confirm)', JSON.stringify(res));
          } else if (context.action === 'reschedule') {
            nextContext.reschedule_queue = appointments.map(a => a.id);
            nextContext.current_reschedule_index = 0;
            const currentApptId = nextContext.reschedule_queue[0];
            const appt = appointments.find(a => a.id === currentApptId);
            
            nextState = 'awaiting_reschedule_date';
            const res = await sendMessage(connection, normalizedPhone, `Vamos reagendar seus atendimentos um por um.\n\nPara o serviço de *${appt.service_name}*, qual a nova data desejada?`);
            console.log('ZAPI SEND RESPONSE (Reschedule Multiple Start)', JSON.stringify(res));
          }
        } else if (option === 'single') {
          console.log('[Webhook] Matched scope: SINGLE');
          nextContext.scope = 'single';
          nextState = 'awaiting_single_appointment_selection';
          const actionLabel = context.action === 'confirm' ? 'confirmar' : context.action === 'reschedule' ? 'reagendar' : 'cancelar';
          const res = await sendMessage(connection, normalizedPhone, `Qual agendamento você deseja ${actionLabel}?\n\n${listAppointments(context.appointments)}`);
          console.log('ZAPI SEND RESPONSE (Single Selection List)', JSON.stringify(res));
        } else {
          const actionLabel = context.action === 'confirm' ? 'confirmar' : context.action === 'reschedule' ? 'reagendar' : 'cancelar';
          await sendMessage(connection, normalizedPhone, `Por favor, escolha uma opção para ${actionLabel}:`, {
            buttons: [
              { id: 'all', label: 'Todos' },
              { id: 'single', label: 'Apenas um' }
            ]
          });
        }
        break;
      }

      case 'awaiting_single_appointment_selection': {
        const index = parseInt(messageText.replace(/\D/g, '')) - 1;
        const appointments = context.appointments || [];
        if (isNaN(index) || index < 0 || index >= appointments.length) {
          await sendMessage(connection, normalizedPhone, `Opção inválida. Escolha o número correspondente ao agendamento:\n\n${listAppointments(appointments)}`);
          return;
        }

        const selectedAppt = appointments[index];
        nextContext.selected_appointment_id = selectedAppt.id;

        if (context.action === 'confirm') {
          await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", selectedAppt.id);
          await triggerNotification(selectedAppt.id, 'appointment_confirmed');
          await finishConversation(`✅ O agendamento de *${selectedAppt.service_name}* foi confirmado com sucesso!`);
          return;
        } else if (context.action === 'cancel') {
          nextState = 'awaiting_cancel_confirmation';
          const res = await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar o agendamento de *${selectedAppt.service_name}*?`, {
            buttons: [
              { id: '1', label: 'Sim, cancelar' },
              { id: '2', label: 'Não, manter' }
            ]
          });
          console.log('ZAPI SEND RESPONSE (Cancel Single Confirm)', JSON.stringify(res));
        } else if (context.action === 'reschedule') {
          nextState = 'awaiting_reschedule_date';
          const res = await sendMessage(connection, normalizedPhone, `Para qual data você deseja reagendar o serviço de *${selectedAppt.service_name}*?`);
          console.log('ZAPI SEND RESPONSE (Reschedule Single Date)', JSON.stringify(res));
        }
        break;
      }

      case 'awaiting_cancel_confirmation': {
        const isYes = ['1', '1️⃣', 'sim', 'cancelar', 'yes', 'cancel', 'all'].some(s => option === s || messageText.includes(s));
        if (isYes) {
          if (context.scope === 'all') {
            for (const appt of context.appointments) {
              await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", appt.id);
              await triggerNotification(appt.id, 'appointment_cancelled');
            }
            await finishConversation(`❌ Todos os seus agendamentos foram cancelados com sucesso.`);
          } else {
            const apptId = context.selected_appointment_id || conversation.appointment_id;
            await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", apptId);
            await triggerNotification(apptId, 'appointment_cancelled');
            await finishConversation(`❌ Seu agendamento foi cancelado com sucesso.`);
          }
        } else {
          await finishConversation(`Ufa! Agendamento mantido. ✅ Se precisar de algo mais, estamos à disposição.`);
        }
        return;
      }

      case 'awaiting_reschedule_date': {
        let targetDate = "";
        const now = new Date();
        
        if (['hoje'].includes(messageText)) {
          targetDate = format(now, "yyyy-MM-dd");
        } else if (['amanhã', 'amanha'].includes(messageText)) {
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
            await sendMessage(connection, normalizedPhone, `Ótimo! Para o dia ${formattedDate}, temos estes horários disponíveis:\n\n${slots.slice(0, 10).join('\n')}\n\nQual horário você prefere?`);
          } else {
            await sendMessage(connection, normalizedPhone, `Infelizmente não temos horários disponíveis para esta data. Por favor, escolha outra data:`);
          }
        } else {
          await sendMessage(connection, normalizedPhone, `Não consegui entender a data. Por favor, informe no formato DD/MM ou diga "Amanhã":`);
        }
        break;
      }

      case 'awaiting_reschedule_time': {
        const timeMatch = messageText.match(/(\d{2}):(\d{2})/);
        if (timeMatch) {
          const newTime = timeMatch[0];
          const newStart = `${context.new_date}T${newTime}:00`;
          const apptId = context.selected_appointment_id || conversation.appointment_id;

          // Fetch current appt to get duration
          const { data: appt } = await supabase.from("appointments").select("duration").eq("id", apptId).single();
          const duration = appt?.duration || 30;
          const newEnd = format(addMinutes(parse(newStart, "yyyy-MM-dd'T'HH:mm:ss", new Date()), duration), "yyyy-MM-dd'T'HH:mm:ss");

          await supabase.from("appointments").update({
            start_time: newStart,
            end_time: newEnd,
            status: 'pending' // Reset to pending after reschedule
          }).eq("id", apptId);

          await triggerNotification(apptId, 'appointment_rescheduled');

          // Check if there are more in the queue
          if (context.reschedule_queue && context.current_reschedule_index < context.reschedule_queue.length - 1) {
            nextContext.current_reschedule_index++;
            const nextApptId = context.reschedule_queue[nextContext.current_reschedule_index];
            const nextAppt = context.appointments.find(a => a.id === nextApptId);
            nextContext.selected_appointment_id = nextApptId;
            nextState = 'awaiting_reschedule_date';
            await sendMessage(connection, normalizedPhone, `✅ Reagendado!\n\nAgora para o serviço de *${nextAppt.service_name}*, qual a nova data desejada?`);
          } else {
            await finishConversation(`✅ Tudo pronto! Seu agendamento foi reagendado para ${format(parse(newStart, "yyyy-MM-dd'T'HH:mm:ss", new Date()), "dd/MM 'às' HH:mm")}.`);
          }
        } else {
          await sendMessage(connection, normalizedPhone, `Por favor, informe o horário no formato HH:MM (ex: 14:30):`);
        }
        break;
      }
    }

    // Update conversation state
    await supabase.from("whatsapp_conversations").update({
      state: nextState,
      context: nextContext,
      updated_at: new Date().toISOString()
    }).eq("id", conversation.id);

    // Log interaction
    await logAutomationInteraction(supabase, conversation, messageText, { from: state, to: nextState }, nextContext.action, body);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Process asynchronously to avoid Z-API timeout
    processWebhook(body).catch(err => {
      console.error("Critical error processing webhook asynchronously:", err);
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
