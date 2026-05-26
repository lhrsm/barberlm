import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
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

  if (url.pathname.endsWith("/process-queue")) {
    const { data: pendingMessages } = await supabase
      .from("whatsapp_messages")
      .select("*, whatsapp_instances(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(20);

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ message: "No pending messages" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    for (const msg of pendingMessages) {
      const conn = msg.whatsapp_instances;
      if (!conn) {
        await supabase.from("whatsapp_messages").update({ status: "failed", error_message: "No instance found" }).eq("id", msg.id);
        continue;
      }

      try {
        let response;
        const targetPhone = normalizePhone(msg.metadata?.phone || msg.wa_id);
        
        if (conn.provider === 'z-api') {
          const instanceId = conn.instance_id;
          const token = conn.token;
          const clientToken = conn.client_token;
          const baseUrl = conn.server_url || "https://api.z-api.io";
          
          const headers: Record<string, string> = { 
            "Content-Type": "application/json",
          };
          if (clientToken) headers["Client-Token"] = clientToken;
          
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

  if (req.method === "POST" && (url.pathname.endsWith("/send") || url.pathname.endsWith("/whatsapp-cloud"))) {
    const body = await req.json();
    const { user_id, event_type, phone, placeholders, appointment_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: corsHeaders });
    }

    const { data: activeInstance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", user_id)
      .eq("connected", true)
      .maybeSingle();

    if (!activeInstance) {
      return new Response(JSON.stringify({ error: "Nenhuma instância ativa do WhatsApp encontrada para este tenant." }), { status: 404, headers: corsHeaders });
    }

    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("user_id", user_id)
      .eq("event_type", event_type)
      .maybeSingle();

    let content = template?.content || "Olá!"; // Simplified for brevity

    if (placeholders) {
      Object.keys(placeholders).forEach(key => {
        content = content.replace(new RegExp(`{{${key}}}`, "g"), placeholders[key]);
      });
    }

    const { data: message, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id,
        connection_id: activeInstance.id, // Column still named connection_id in whatsapp_messages for now
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

    fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud/process-queue`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supabaseKey}` }
    }).catch(e => console.error("Error triggering queue:", e));
    
    return new Response(JSON.stringify({ success: true, message_id: message.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response("Not Found", { status: 404 });
});
