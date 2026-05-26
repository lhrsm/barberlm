import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { formatBrazilDate } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 1. Handling connection updates
    if (type === "Connected" || type === "Disconnected") {
      const status = type.toLowerCase();
      await supabase.from("whatsapp_instances").update({ status, connected: type === "Connected" }).eq("instance_id", instanceId);
      return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
    }

    // 2. Handling Incoming Messages
    if (type === "ReceivedMessage") {
      const normalizedPhone = phone.replace(/\D/g, "");
      const messageText = text?.message?.trim()?.toLowerCase();

      if (!messageText) return new Response("No text", { status: 200 });

      // Find active conversation
      const { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("*, barbers(*), customers(*), appointments(*)")
        .eq("phone", normalizedPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('MESSAGE', messageText);
      console.log('PHONE', normalizedPhone);
      
      if (!conversation) {
        console.log("No active conversation for", normalizedPhone);
        return new Response("No conversation", { status: 200 });
      }

      console.log('STATE', conversation.state);

      const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
      if (!connection) return new Response("No Z-API settings", { status: 200 });

      const context = conversation.context || {};
      const state = conversation.state;
      let nextState = state;

      // STATE MACHINE LOGIC
      switch (state) {
        case 'awaiting_confirmation': {
          if (['1', '1️⃣', 'confirmar', 'confirmado', 'ok'].includes(messageText)) {
            await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", conversation.appointment_id);
            await sendMessage(connection, normalizedPhone, `✅ Seu agendamento foi confirmado com sucesso!\n\nEsperamos você na ${context.business_name || 'barbearia'} 💈`);
            await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
            nextState = 'done';
          } 
          else if (['2', '2️⃣', 'reagendar'].includes(messageText)) {
            nextState = 'awaiting_reschedule_date';
            await sendMessage(connection, normalizedPhone, `Entendi! Vamos reagendar seu atendimento.\n\nPara qual dia você gostaria de mudar? (Ex: Amanhã, Segunda, ou uma data como 25/05)`);
            await supabase.from("whatsapp_conversations").update({ 
              state: nextState,
              updated_at: new Date().toISOString()
            }).eq("id", conversation.id);
          }
          else if (['3', '3️⃣', 'cancelar'].includes(messageText)) {
            nextState = 'awaiting_cancel_confirmation';
            await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar seu agendamento?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter agendamento`);
            await supabase.from("whatsapp_conversations").update({ 
              state: nextState,
              updated_at: new Date().toISOString()
            }).eq("id", conversation.id);
          }
          else {
            await sendMessage(connection, normalizedPhone, `Desculpe, não entendi.\n\nPor favor, responda com:\n1️⃣ para Confirmar\n2️⃣ para Reagendar\n3️⃣ para Cancelar`);
          }
          break;
        }

        case 'awaiting_reschedule_date': {
          // In a real implementation, we would parse the date and check availability.
          // For now, we direct them to the link as it's safer and handles professional availability correctly.
          nextState = 'done';
          await sendMessage(connection, normalizedPhone, `Perfeito 👍\n\nPara garantir que você veja todos os horários disponíveis em tempo real, por favor acesse nosso link de agendamento:\n\nhttps://barberlm.app/agendar/${conversation.barber_id}?reschedule=${conversation.appointment_id}\n\nO sistema atualizará seu horário automaticamente.`);
          await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
          break;
        }

        case 'awaiting_cancel_confirmation': {
          if (['1', '1️⃣', 'sim', 'cancelar'].includes(messageText)) {
            await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", conversation.appointment_id);
            await sendMessage(connection, normalizedPhone, `❌ Seu agendamento foi cancelado com sucesso. Esperamos ver você em breve!`);
            await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
            nextState = 'done';
          } else {
            nextState = 'awaiting_confirmation';
            await sendMessage(connection, normalizedPhone, `Ufa! Agendamento mantido. ✅\n\nCaso precise de algo mais, estou à disposição.`);
            await supabase.from("whatsapp_conversations").update({ 
              state: nextState,
              updated_at: new Date().toISOString()
            }).eq("id", conversation.id);
          }
          break;
        }

        default: {
          console.log(`Unknown state: ${state}`);
          await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
        }
      }

      console.log('NEXT STATE', nextState);
      return new Response(JSON.stringify({ status: "success", state: nextState }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
  }
});
