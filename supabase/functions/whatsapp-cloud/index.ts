import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  // Remove non-digits
  let digits = phone.replace(/\D/g, "");
  
  // If it doesn't start with 55 and has 10 or 11 digits, add 55
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // 1. Queue Processor
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
      if (!conn) {
        await supabase.from("whatsapp_messages").update({ status: "failed", error_message: "No connection found" }).eq("id", msg.id);
        continue;
      }

      try {
        let response;
        const targetPhone = normalizePhone(msg.metadata?.phone || msg.wa_id);
        
        if (conn.provider === 'z-api') {
          const instanceId = conn.instance_id;
          const token = conn.instance_token;
          const baseUrl = conn.server_url || "https://api.z-api.io";
          
          const headers = { 
            "Content-Type": "application/json",
          };
          
          console.log(`[Z-API] Sending via ${baseUrl} to ${targetPhone}`);

          const startTime = Date.now();
          response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              phone: targetPhone,
              message: msg.content
            }),
          });
          const endTime = Date.now();

          const result = await response.json();
          const executionTime = endTime - startTime;

          // Log detail to automation_logs
          await supabase.from("automation_logs").insert({
            barber_id: msg.user_id,
            status: response.ok ? 'sent' : 'error',
            message_type: 'whatsapp_send',
            phone: targetPhone,
            response: {
              status: response.status,
              body: result,
              execution_time_ms: executionTime,
              instance_id: instanceId
            }
          });

          if (response.ok && (result.messageId || result.id || result.messages)) {
            await supabase.from("whatsapp_messages").update({ 
              status: "sent", 
              wa_id: (result.messages ? result.messages[0].id : (result.id || result.messageId)),
              updated_at: new Date().toISOString()
            }).eq("id", msg.id);
          } else {
            await supabase.from("whatsapp_messages").update({ 
              status: "failed", 
              error_message: JSON.stringify(result.error || result),
              updated_at: new Date().toISOString()
            }).eq("id", msg.id);
          }
          results.push({ id: msg.id, result });

        } else {
          // Default to Meta Cloud API
          response = await fetch(`https://graph.facebook.com/v17.0/${conn.phone_number_id}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${conn.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: targetPhone,
              type: "text",
              text: { body: msg.content }
            }),
          });

          const result = await response.json();
          if (result.messages || result.id) {
            await supabase.from("whatsapp_messages").update({ 
              status: "sent", 
              wa_id: (result.messages ? result.messages[0].id : result.id),
              updated_at: new Date().toISOString()
            }).eq("id", msg.id);
          } else {
            await supabase.from("whatsapp_messages").update({ 
              status: "failed", 
              error_message: JSON.stringify(result.error || result),
              updated_at: new Date().toISOString()
            }).eq("id", msg.id);
          }
          results.push({ id: msg.id, result });
        }
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err.message);
        results.push({ id: msg.id, error: err.message });
        await supabase.from("whatsapp_messages").update({ 
          status: "failed", 
          error_message: err.message,
          updated_at: new Date().toISOString()
        }).eq("id", msg.id);
      }
    }

    return new Response(JSON.stringify({ processed: pendingMessages.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 2. Main Sender Endpoint
  if (req.method === "POST" && (url.pathname.endsWith("/send") || url.pathname.endsWith("/whatsapp-cloud"))) {
    const body = await req.json();
    const { user_id, event_type, phone, placeholders, appointment_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch Connection
    const { data: activeConn } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .or(`tenant_id.eq.${user_id},barbershop_id.eq.${user_id}`)
      .eq("status", "connected")
      .maybeSingle();

    if (!activeConn) {
      return new Response(JSON.stringify({ error: "Nenhuma conexão ativa do WhatsApp encontrada para este tenant." }), { status: 404, headers: corsHeaders });
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

    const { data: message, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id,
        connection_id: activeConn.id,
        status: "pending",
        content,
        metadata: { phone, appointment_id, ...placeholders },
        scheduled_for: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }

    // Trigger immediate process (background)
    fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud/process-queue`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supabaseKey}` }
    }).catch(e => console.error("Error triggering queue:", e));
    
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
