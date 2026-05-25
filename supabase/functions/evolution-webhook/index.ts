
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("Evolution Webhook Received:", body);

    const { event, data, instance } = body;

    // 1. Find the connection associated with this instance
    const { data: conn, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("instance_name", instance)
      .maybeSingle();

    if (connError || !conn) {
      console.error(`Connection not found for instance: ${instance}`);
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404 });
    }

    // 2. Handle events
    switch (event) {
      case 'CONNECTION_UPDATE':
        if (data.state === 'open') {
          await supabase.from("whatsapp_connections").update({ 
            status: 'connected', 
            last_connection: new Date().toISOString() 
          }).eq("id", conn.id);
        } else if (data.state === 'close' || data.state === 'connecting') {
          await supabase.from("whatsapp_connections").update({ 
            status: data.state === 'connecting' ? 'connecting' : 'disconnected' 
          }).eq("id", conn.id);
        }
        break;

      case 'MESSAGES_UPSERT':
        if (data.message && !data.key.fromMe) {
          // Handle incoming message (can be used for chatbots or auto-replies)
          const content = data.message.conversation || data.message.extendedTextMessage?.text || "";
          const phone = data.key.remoteJid.split('@')[0];
          
          await supabase.from("whatsapp_messages").insert({
            user_id: conn.barbershop_id,
            connection_id: conn.id,
            type: 'received',
            status: 'read',
            content: content,
            metadata: { phone }
          });
        }
        break;

      case 'SEND_MESSAGE':
        // Update log if we sent a message
        if (data.message) {
            const content = data.message.conversation || data.message.extendedTextMessage?.text || "";
            const phone = data.key.remoteJid.split('@')[0];
            
            await supabase.from("whatsapp_messages").insert({
              user_id: conn.barbershop_id,
              connection_id: conn.id,
              type: 'sent',
              status: 'sent',
              content: content,
              metadata: { phone }
            });
        }
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
