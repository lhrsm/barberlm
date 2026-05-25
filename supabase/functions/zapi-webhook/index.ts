import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    const { instanceId, type } = body;

    // Encontrar a conexão baseada no instanceId
    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!connection) {
      console.warn(`Conexão não encontrada para instanceId: ${instanceId}`);
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }

    const tenantId = connection.barbershop_id;

    // Processar diferentes tipos de eventos
    // Z-API types: ReceivedMessage, MessageStatus, ChatState, etc.
    
    if (type === "ReceivedMessage") {
      const message = body.text?.message || body.image?.caption || "Mensagem recebida";
      const from = body.phone;

      // Salvar log da mensagem
      await supabase.from("whatsapp_messages").insert({
        user_id: tenantId,
        barbershop_id: tenantId,
        content: message,
        status: 'received',
        metadata: { phone: from, raw: body }
      });

      // Aqui poderiam ser disparadas as automações (AI, confirmações, etc.)
    } else if (type === "MessageStatus") {
      // Atualizar status de uma mensagem enviada anteriormente se tivermos o ID
      const status = body.status; // DELIVERED, READ, etc.
      // ... lógica para atualizar status se necessário
    } else if (type === "Connected") {
      await supabase
        .from("whatsapp_connections")
        .update({ status: 'connected', updated_at: new Date().toISOString() })
        .eq("id", connection.id);
    } else if (type === "Disconnected") {
      await supabase
        .from("whatsapp_connections")
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq("id", connection.id);
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
