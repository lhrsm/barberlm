
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // Webhook Verification (Meta requirement)
  if (req.method === "GET" && url.pathname.endsWith("/webhook")) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // We verify against our database connections
    // For simplicity, we can also check a global secret if preferred, 
    // but the spec says each connection has its own verify_token.
    // In practice, Meta sends one global verify token per App.
    // So we'll use a global env var WHATSAPP_VERIFY_TOKEN for the webhook setup.
    const globalVerifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "my-default-verify-token";

    if (mode === "subscribe" && token === globalVerifyToken) {
      console.log("WEBHOOK_VERIFIED");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("WEBHOOK_VERIFICATION_FAILED");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Handle Webhook Notifications (Status updates and incoming messages)
  if (req.method === "POST" && url.pathname.endsWith("/webhook")) {
    const body = await req.json();
    console.log("WHATSAPP_WEBHOOK_RECEIVED:", JSON.stringify(body));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      const statusUpdate = value.statuses[0];
      const wa_id = statusUpdate.id;
      const status = statusUpdate.status; // delivered, read, failed

      // Update message status in DB
      await supabase
        .from("whatsapp_messages")
        .update({ status: status === 'sent' ? 'sent' : status })
        .eq("wa_id", wa_id);
    }

    if (value?.messages) {
      const message = value.messages[0];
      const from = message.from;
      const text = message.text?.body;
      const wa_id = message.id;
      const phone_number_id = value.metadata?.phone_number_id;

      // Find connection and user_id
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("id, user_id")
        .eq("phone_number_id", phone_number_id)
        .single();

      if (conn) {
        // Log incoming message
        await supabase.from("whatsapp_messages").insert({
          user_id: conn.user_id,
          connection_id: conn.id,
          type: "received",
          status: "read",
          content: text,
          wa_id: wa_id,
          metadata: { from }
        });
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  // Handle Sending Messages
  if (req.method === "POST" && url.pathname.endsWith("/send")) {
    try {
      const { user_id, event_type, phone, placeholders, appointment_id } = await req.json();

      if (!user_id || !phone) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 1. Fetch Connection
      const { data: conn, error: connError } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "No active WhatsApp connection found" }), { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 2. Fetch Template
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("content")
        .eq("user_id", user_id)
        .eq("event_type", event_type)
        .maybeSingle();

      let content = "";
      if (template) {
        content = template.content;
      } else {
        // Fallback to defaults if not found
        content = getDefaultTemplate(event_type);
      }

      // 3. Replace Placeholders
      if (placeholders) {
        Object.keys(placeholders).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, "g");
          content = content.replace(regex, placeholders[key]);
        });
      }

      // 4. Send to Meta Cloud API
      const response = await fetch(`https://graph.facebook.com/v17.0/${conn.phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${conn.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.replace(/\D/g, ""), // Clean phone number
          type: "text",
          text: { body: content }
        }),
      });

      const result = await response.json();

      // 5. Log Message
      const { error: logError } = await supabase.from("whatsapp_messages").insert({
        user_id: user_id,
        connection_id: conn.id,
        customer_id: placeholders?.customer_id || null,
        type: "sent",
        status: result.messages ? "sent" : "failed",
        content: content,
        wa_id: result.messages?.[0]?.id,
        error_message: result.error?.message,
        metadata: { appointment_id, ...placeholders }
      });

      return new Response(JSON.stringify(result), { 
        status: response.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }

  return new Response("Not Found", { status: 404 });
});

function getDefaultTemplate(eventType: string) {
  switch(eventType) {
    case 'appointment_confirmation':
      return "Olá! Seu agendamento foi confirmado para {{horario}} com o barbeiro {{barbeiro}}.";
    case 'reminder':
      return "Lembrete: Você tem um horário hoje às {{horario}}.";
    case 'cancellation':
      return "Seu agendamento para {{horario}} foi cancelado.";
    case 'cashback':
      return "Você recebeu R$ {{cashback}} de cashback!";
    case 'payment_confirmed':
      return "Pagamento de R$ {{valor}} confirmado.";
    case 'service_completed':
      return "Serviço concluído! Você ganhou R$ {{cashback}} de cashback.";
    default:
      return "Olá!";
  }
}
