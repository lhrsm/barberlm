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

    const url = new URL(req.url);
    const body = await req.json();
    
    // Extract barberId from URL if present (format: .../zapi-webhook/[barberId])
    const pathParts = url.pathname.split('/');
    const barberIdFromUrl = pathParts[pathParts.length - 1] !== 'zapi-webhook' ? pathParts[pathParts.length - 1] : null;

    console.log("Z-API Webhook received:", JSON.stringify(body));
    console.log("BarberId from URL:", barberIdFromUrl);

    const { instanceId, type, phone } = body;

    let barberId = barberIdFromUrl;
    let connection = null;

    // Find connection by instanceId if not provided in URL
    if (!barberId) {
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("instance_id", instanceId)
        .maybeSingle();
      
      if (conn) {
        connection = conn;
        barberId = conn.barber_id;
      }
    }

    if (!barberId) {
      console.warn(`Barbeiro não identificado para o evento Z-API instance ${instanceId}`);
      return new Response(JSON.stringify({ status: "ignored", reason: "barber_not_found" }), { 
        headers: corsHeaders,
        status: 200 
      });
    }

    // Save Webhook Log
    const { error: logError } = await supabase.from("automation_logs").insert({
      barber_id: barberId,
      status: 'received',
      message_type: type || 'webhook_event',
      phone: phone,
      response: body
    });

    if (logError) console.error("Erro ao salvar log de webhook:", logError);

    // Business Logic
    switch (type) {
      case "Connected": {
        await supabase
          .from("whatsapp_connections")
          .update({ 
            status: 'connected', 
            connected: true,
            updated_at: new Date().toISOString(),
            phone: phone || connection?.phone
          })
          .eq("instance_id", instanceId);

        // Also update whatsapp_instances to keep synced
        await supabase
          .from("whatsapp_instances")
          .update({ 
            status: 'connected', 
            connected: true,
            phone: phone
          })
          .eq("instance_name", body.instanceId || instanceId); // Best effort sync
        break;
      }
      case "Disconnected": {
        await supabase
          .from("whatsapp_connections")
          .update({ 
            status: 'disconnected', 
            connected: false,
            updated_at: new Date().toISOString() 
          })
          .eq("instance_id", instanceId);

        await supabase
          .from("whatsapp_instances")
          .update({ 
            status: 'disconnected', 
            connected: false
          })
          .eq("instance_name", body.instanceId || instanceId);
        break;
      }
      case "ReceivedMessage": {
        // Handle received message if needed
        break;
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
