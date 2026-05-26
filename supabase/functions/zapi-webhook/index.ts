import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";

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

    // 1. Handling connection updates (Already exists in current webhook, but keeping logic consistent)
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

      if (!conversation) {
        console.log("No active conversation for", normalizedPhone);
        return new Response("No conversation", { status: 200 });
      }

      const connection = await getWhatsAppSettings(supabase, conversation.barber_id);
      if (!connection) return new Response("No Z-API settings", { status: 200 });

      const context = conversation.context || {};
      const state = conversation.state;

      // STATE MACHINE LOGIC
      if (state === 'awaiting_confirmation') {
        if (['1', '1️⃣', 'confirmar', 'confirmado', 'ok'].includes(messageText)) {
          // Confirm appointment
          await supabase.from("appointments").update({ status: 'confirmed' }).eq("id", conversation.appointment_id);
          await sendMessage(connection, normalizedPhone, `✅ Seu agendamento foi confirmado com sucesso!\n\nEsperamos você na ${context.business_name} 💈`);
          await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
        } 
        else if (['2', '2️⃣', 'reagendar'].includes(messageText)) {
          // Start reschedule flow
          await sendMessage(connection, normalizedPhone, `Perfeito 👍\n\nPor favor, acesse o link abaixo para escolher um novo horário:\n\nhttps://barberlm.app/agendar/${conversation.barber_id}?reschedule=${conversation.appointment_id}`);
          // Reusing existing web booking logic is safer for now as requested "NÃO criar lógica paralela"
          // but if we want full conversational we need a date/time picker logic
          await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
        }
        else if (['3', '3️⃣', 'cancelar'].includes(messageText)) {
          await sendMessage(connection, normalizedPhone, `Tem certeza que deseja cancelar seu agendamento?\n\n1️⃣ Sim\n2️⃣ Não`);
          await supabase.from("whatsapp_conversations").update({ state: 'awaiting_cancel_confirmation' }).eq("id", conversation.id);
        }
      } 
      else if (state === 'awaiting_cancel_confirmation') {
        if (['1', '1️⃣', 'sim', 'cancelar'].includes(messageText)) {
          await supabase.from("appointments").update({ status: 'cancelled' }).eq("id", conversation.appointment_id);
          await sendMessage(connection, normalizedPhone, `❌ Seu agendamento foi cancelado com sucesso.`);
          await supabase.from("whatsapp_conversations").delete().eq("id", conversation.id);
        } else {
          await sendMessage(connection, normalizedPhone, `Ok, agendamento mantido!`);
          await supabase.from("whatsapp_conversations").update({ state: 'awaiting_confirmation' }).eq("id", conversation.id);
        }
      }

      return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
  }
});
