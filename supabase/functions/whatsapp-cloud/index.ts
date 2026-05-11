
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // 1. Webhook Verification
  if (req.method === "GET" && url.pathname.endsWith("/webhook")) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Check if any connection has this verify token
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("id")
      .eq("webhook_verify_token", token)
      .maybeSingle();

    if (mode === "subscribe" && (token === Deno.env.get("WHATSAPP_GLOBAL_VERIFY_TOKEN") || conn)) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Queue Processor (Can be called by Cron)
  if (url.pathname.endsWith("/process-queue")) {
    const { data: pendingMessages } = await supabase
      .from("whatsapp_messages")
      .select("*, whatsapp_connections(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(20);

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ message: "No pending messages" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    for (const msg of pendingMessages) {
      const conn = msg.whatsapp_connections;
      if (!conn || !conn.access_token) {
        await supabase.from("whatsapp_messages").update({ status: "failed", error_message: "No connection found" }).eq("id", msg.id);
        continue;
      }

      try {
        const response = await fetch(`https://graph.facebook.com/v17.0/${conn.phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${conn.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: msg.metadata?.phone || msg.wa_id, // wa_id is sometimes used for phone in logs
            type: "text",
            text: { body: msg.content }
          }),
        });

        const result = await response.json();
        if (result.messages) {
          await supabase.from("whatsapp_messages").update({ 
            status: "sent", 
            wa_id: result.messages[0].id 
          }).eq("id", msg.id);
        } else {
          await supabase.from("whatsapp_messages").update({ 
            status: "failed", 
            error_message: JSON.stringify(result.error) 
          }).eq("id", msg.id);
        }
        results.push({ id: msg.id, result });
      } catch (err) {
        results.push({ id: msg.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: pendingMessages.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 3. Main Sender Endpoint
  if (req.method === "POST" && url.pathname.endsWith("/send")) {
    const { user_id, event_type, phone, placeholders, appointment_id } = await req.json();

    // Fetch Connection
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ error: "No active WhatsApp connection" }), { status: 404, headers: corsHeaders });
    }

    // Fetch Template
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("user_id", user_id)
      .eq("event_type", event_type)
      .maybeSingle();

    let content = template?.content || getDefaultTemplate(event_type);

    // Replace placeholders
    if (placeholders) {
      Object.keys(placeholders).forEach(key => {
        content = content.replace(new RegExp(`{{${key}}}`, "g"), placeholders[key]);
      });
    }

    // Instead of sending immediately, we can queue it or send it now
    // The user asked for "Fila de envio", so let's just insert into the queue
    const { data: message, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id,
        connection_id: conn.id,
        type: "sent",
        status: "pending",
        content,
        metadata: { phone, appointment_id, ...placeholders }
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }

    // Trigger immediate process for this message
    // In production, this would be handled by a queue worker or cron
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud/process-queue`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supabaseKey}` }
    });
    
    return new Response(JSON.stringify({ success: true, message_id: message.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response("Not Found", { status: 404 });
});

function getDefaultTemplate(eventType: string) {
  switch(eventType) {
    case 'appointment_confirmation': return "Olá {{cliente}}! Seu agendamento foi confirmado para {{horario}}.";
    case 'reminder': return "Lembrete: Você tem um horário hoje às {{horario}}.";
    case 'cancellation': return "Seu agendamento para {{horario}} foi cancelado.";
    case 'cashback': return "Você recebeu R$ {{cashback}} de cashback!";
    case 'payment_confirmed': return "Pagamento confirmado.";
    case 'service_completed': return "Serviço concluído!";
    default: return "Olá!";
  }
}
