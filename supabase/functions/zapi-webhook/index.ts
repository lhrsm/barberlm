
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

async function logAutomationInteraction(supabase: any, conversation: any, message: string, stateChange: { from: string, to: string }, action?: string, error?: string) {
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
      original_template: message, // Received message
      processed_template: `State: ${stateChange.from} -> ${stateChange.to} | Action: ${action || 'none'}`,
      error_message: error,
      sent_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error logging interaction:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log("Z-API Webhook received:", JSON.stringify(body));

    const { instanceId, type, text, phone } = body;

    if (type === "Connected" || type === "Disconnected") {
      const status = type.toLowerCase();
      await supabase.from("whatsapp_instances").update({ status, connected: type === "Connected" }).eq("instance_id", instanceId);
      return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
    }

    if (type === "ReceivedMessage") {
      const normalizedPhone = normalizePhone(phone);
      const messageText = text?.message?.trim()?.toLowerCase() || "";

      if (!messageText) return new Response("No text", { status: 200 });

      // Find active conversation
      const { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conversation) {
        console.log("No active conversation for", normalizedPhone);
        return new Response("No conversation", { status: 200 });
      }

      const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
      if (!connection) return new Response("No Z-API settings", { status: 200 });

      const context = conversation.context || {};
      const state = conversation.state;
      let nextState = state;
      let nextContext = { ...context };

      console.log(`Processing message: "${messageText}" in state: "${state}"`);

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
        await sendMessage(connection, normalizedPhone, message);
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
          const isConfirm = ['1', '1️⃣', 'confirmar', 'confirmar agendamento', 'sim', 'ok'].some(s => messageText.includes(s));
          const isReschedule = ['2', '2️⃣', 'reagendar'].some(s => messageText.includes(s));
          const isCancel = ['3', '3️⃣', 'cancelar'].some(s => messageText.includes(s));

          if (isConfirm) {
            nextContext.action = 'confirm';
          } else if (isReschedule) {
            nextContext.action = 'reschedule';
          } else if (isCancel) {
            nextContext.action = 'cancel';
          } else {
            await sendMessage(connection, normalizedPhone, `Desculpe, não entendi.\n\nPor favor, escolha uma opção:\n\n✅ Confirmar agendamento\n🔁 Reagendar\n❌ Cancelar`);
            return new Response("Invalid option", { status: 200 });
          }

          // If multiple appointments, ask for scope
          if (context.appointments && context.appointments.length > 1) {
            nextState = 'awaiting_scope_selection';
            const actionLabel = nextContext.action === 'confirm' ? 'confirmar' : nextContext.action === 'reschedule' ? 'reagendar' : 'cancelar';
            await sendMessage(connection, normalizedPhone, `Você deseja ${actionLabel}:\n\n1️⃣ Todos os agendamentos\n2️⃣ Apenas um agendamento específico`);
          } else {
            // Single appointment flow
            const apptId = context.appointments?.[0]?.id || conversation.appointment_id;
            nextContext.selected_appointment_id = apptId;
            
            if (nextContext.action === 'confirm') {
              await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", apptId);
              await triggerNotification(apptId, 'appointment_confirmed');
              await finishConversation(`✅ Agendamento confirmado com sucesso! Esperamos você na ${context.business_name || 'barbearia'}.`);
            } else if (nextContext.action === 'cancel') {
              nextState = 'awaiting_cancel_confirmation';
              await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar seu agendamento?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter agendamento`);
            } else if (nextContext.action === 'reschedule') {
              nextState = 'awaiting_reschedule_date';
              await sendMessage(connection, normalizedPhone, `Para qual data você deseja reagendar? (Ex: Hoje, Amanhã, ou uma data como 25/05)`);
            }
          }
          break;
        }

        case 'awaiting_scope_selection': {
          if (['1', '1️⃣', 'todos', 'tudo'].some(s => messageText.includes(s))) {
            nextContext.scope = 'all';
            const appointments = context.appointments || [];
            
            if (nextContext.action === 'confirm') {
              for (const appt of appointments) {
                await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", appt.id);
                await triggerNotification(appt.id, 'appointment_confirmed');
              }
              await finishConversation(`✅ Todos os seus agendamentos foram confirmados com sucesso!`);
            } else if (nextContext.action === 'cancel') {
              nextState = 'awaiting_cancel_confirmation';
              await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar TODOS os seus agendamentos?\n\n1️⃣ Sim, cancelar tudo\n2️⃣ Não, manter agendamentos`);
            } else if (nextContext.action === 'reschedule') {
              // Rescheduling multiple is tricky, we'll do them one by one
              nextContext.reschedule_queue = appointments.map(a => a.id);
              nextContext.current_reschedule_index = 0;
              const currentApptId = nextContext.reschedule_queue[0];
              const appt = appointments.find(a => a.id === currentApptId);
              
              nextState = 'awaiting_reschedule_date';
              await sendMessage(connection, normalizedPhone, `Vamos reagendar seus atendimentos um por um.\n\nPara o serviço de *${appt.service_name}*, qual a nova data desejada?`);
            }
          } else if (['2', '2️⃣', 'apenas um', 'específico'].some(s => messageText.includes(s))) {
            nextContext.scope = 'single';
            nextState = 'awaiting_single_appointment_selection';
            const actionLabel = context.action === 'confirm' ? 'confirmar' : context.action === 'reschedule' ? 'reagendar' : 'cancelar';
            await sendMessage(connection, normalizedPhone, `Qual agendamento você deseja ${actionLabel}?\n\n${listAppointments(context.appointments)}`);
          } else {
            await sendMessage(connection, normalizedPhone, `Por favor, escolha uma opção:\n\n1️⃣ Todos os agendamentos\n2️⃣ Apenas um agendamento específico`);
          }
          break;
        }

        case 'awaiting_single_appointment_selection': {
          const index = parseInt(messageText.replace(/\D/g, '')) - 1;
          const appointments = context.appointments || [];
          if (isNaN(index) || index < 0 || index >= appointments.length) {
            await sendMessage(connection, normalizedPhone, `Opção inválida. Escolha o número correspondente ao agendamento:\n\n${listAppointments(appointments)}`);
            return new Response("Invalid index", { status: 200 });
          }

          const selectedAppt = appointments[index];
          nextContext.selected_appointment_id = selectedAppt.id;

          if (context.action === 'confirm') {
            await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", selectedAppt.id);
            await triggerNotification(selectedAppt.id, 'appointment_confirmed');
            await finishConversation(`✅ O agendamento de *${selectedAppt.service_name}* foi confirmado com sucesso!`);
          } else if (context.action === 'cancel') {
            nextState = 'awaiting_cancel_confirmation';
            await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar o agendamento de *${selectedAppt.service_name}*?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter agendamento`);
          } else if (context.action === 'reschedule') {
            nextState = 'awaiting_reschedule_date';
            await sendMessage(connection, normalizedPhone, `Para qual data você deseja reagendar o serviço de *${selectedAppt.service_name}*?`);
          }
          break;
        }

        case 'awaiting_cancel_confirmation': {
          if (['1', '1️⃣', 'sim', 'cancelar'].some(s => messageText.includes(s))) {
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
          break;
        }

        case 'awaiting_reschedule_date': {
          let targetDate = "";
          const now = new Date();
          
          if (['hoje'].includes(messageText)) {
            targetDate = format(now, "yyyy-MM-dd");
          } else if (['amanhã', 'amanha'].includes(messageText)) {
            targetDate = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");
          } else {
            // Try to parse date like DD/MM
            const dateMatch = messageText.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const day = dateMatch[1].padStart(2, '0');
              const month = dateMatch[2].padStart(2, '0');
              targetDate = `${now.getFullYear()}-${month}-${day}`;
            } else {
              await sendMessage(connection, normalizedPhone, `Não consegui entender a data. Por favor, envie no formato DD/MM (ex: 25/05) ou escreva 'Hoje' ou 'Amanhã'.`);
              return new Response("Invalid date", { status: 200 });
            }
          }

          nextContext.selected_date = targetDate;
          
          // Get appointments details to know barber and service
          const apptId = context.scope === 'all' 
            ? context.reschedule_queue[context.current_reschedule_index]
            : (context.selected_appointment_id || conversation.appointment_id);
          
          const { data: appt } = await supabase
            .from("appointments")
            .select("*, services(duration_minutes)")
            .eq("id", apptId)
            .single();

          if (!appt) {
            await finishConversation("Ocorreu um erro ao buscar detalhes do agendamento. Por favor, tente novamente mais tarde.");
            return new Response("Appt not found", { status: 200 });
          }

          const slots = await getAvailableSlots(supabase, appt.barber_id, targetDate, appt.services?.duration_minutes || 30);
          
          if (slots.length === 0) {
            await sendMessage(connection, normalizedPhone, `Infelizmente não há horários disponíveis para o dia ${format(new Date(targetDate + "T12:00:00"), "dd/MM")}. Por favor, escolha outra data.`);
          } else {
            nextState = 'awaiting_reschedule_time';
            nextContext.available_slots = slots;
            const slotsMsg = slots.slice(0, 10).map((s, i) => `${i + 1}️⃣ ${s}`).join('\n');
            await sendMessage(connection, normalizedPhone, `Horários disponíveis para ${format(new Date(targetDate + "T12:00:00"), "dd/MM")}:\n\n${slotsMsg}\n\nResponda com o número da opção desejada.`);
          }
          break;
        }

        case 'awaiting_reschedule_time': {
          const index = parseInt(messageText.replace(/\D/g, '')) - 1;
          const slots = context.available_slots || [];
          
          if (isNaN(index) || index < 0 || index >= slots.length) {
            const slotsMsg = slots.slice(0, 10).map((s, i) => `${i + 1}️⃣ ${s}`).join('\n');
            await sendMessage(connection, normalizedPhone, `Opção inválida. Escolha um número da lista:\n\n${slotsMsg}`);
            return new Response("Invalid index", { status: 200 });
          }

          const selectedTime = slots[index];
          const targetDate = context.selected_date;
          const apptId = context.scope === 'all' 
            ? context.reschedule_queue[context.current_reschedule_index]
            : (context.selected_appointment_id || conversation.appointment_id);

          // Update appointment
          const { data: appt } = await supabase.from("appointments").select("*, services(duration_minutes)").eq("id", apptId).single();
          const duration = appt.services?.duration_minutes || 30;
          
          const startTime = `${targetDate}T${selectedTime}:00`;
          const endTimeDate = new Date(new Date(startTime).getTime() + duration * 60 * 1000);
          const endTime = endTimeDate.toISOString();

          await supabase.from("appointments").update({
            start_time: startTime,
            end_time: endTime,
            status: 'scheduled',
            updated_at: new Date().toISOString()
          }).eq("id", apptId);

          await triggerNotification(apptId, 'appointment_rescheduled');

          if (context.scope === 'all' && context.current_reschedule_index < context.reschedule_queue.length - 1) {
            nextContext.current_reschedule_index++;
            const nextApptId = context.reschedule_queue[nextContext.current_reschedule_index];
            const nextAppt = context.appointments.find(a => a.id === nextApptId);
            
            nextState = 'awaiting_reschedule_date';
            await sendMessage(connection, normalizedPhone, `✅ Reagendado!\n\nAgora, para o serviço de *${nextAppt.service_name}*, qual a nova data desejada?`);
          } else {
            await finishConversation(`✅ Reagendamento concluído com sucesso! Seu novo horário é dia ${format(new Date(startTime), "dd/MM")} às ${selectedTime}.`);
          }
          break;
        }

        default: {
          console.log(`Unknown state: ${state}`);
          await supabase.from("whatsapp_conversations").update({ active: false }).eq("id", conversation.id);
        }
      }

      // Save next state and context
      await supabase.from("whatsapp_conversations").update({ 
        state: nextState,
        context: nextContext,
        updated_at: new Date().toISOString()
      }).eq("id", conversation.id);

      return new Response(JSON.stringify({ status: "success", state: nextState }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
  }
});
