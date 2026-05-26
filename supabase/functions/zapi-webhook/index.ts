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
    await supabase.from("automation_logs").insert({
      barber_id: barberId,
      status: 'received',
      message_type: type || 'webhook_event',
      phone: phone || body.phone,
      response: body
    });

    // Business Logic
    let status = '';
    let isConnected = false;

    if (type === "Connected" || type === "update-webhook-connected") {
      status = 'connected';
      isConnected = true;
    } else if (type === "Disconnected" || type === "update-webhook-disconnected") {
      status = 'disconnected';
      isConnected = false;
    }

    if (status) {
      console.log(`Updating status for barber ${barberId} to ${status}`);
      
      // Update whatsapp_connections
      await supabase
        .from("whatsapp_connections")
        .update({ 
          status, 
          connected: isConnected,
          updated_at: new Date().toISOString(),
          phone: phone || connection?.phone || body.phone
        })
        .eq("barber_id", barberId);

      // Sync with whatsapp_instances
      await supabase
        .from("whatsapp_instances")
        .update({ 
          status, 
          connected: isConnected,
          phone: phone || body.phone,
          updated_at: new Date().toISOString()
        })
        .eq("barber_id", barberId);
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
