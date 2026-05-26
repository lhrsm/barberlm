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

    const { action, connectionId, data } = await req.json();

    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    // First try to get full settings from barbershop_settings
    const { data: settings } = await supabase
      .from("barbershop_settings")
      .select("*")
      .eq("barber_id", connection.barbershop_id)
      .maybeSingle();

    const instanceId = settings?.instance_id || connection.instance_id;
    const token = settings?.instance_token || connection.instance_token;
    const clientToken = settings?.client_token;
    const baseUrl = settings?.server_url || connection.server_url || "https://api.z-api.io";

    console.log(`[Z-API] Action: ${action} | Instance: ${instanceId}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (clientToken) {
      headers["client-token"] = clientToken;
    }

    if (action === "check-status") {
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/status`;
      console.log(`[Z-API] GET Status URL: ${url}`);
      
      const res = await fetch(url, {
        method: "GET",
        headers
      });
      
      const result = await res.json();
      console.log(`[Z-API] INSTANCE ID: ${instanceId}`);
      console.log(`[Z-API] TOKEN: ${token}`);
      console.log(`[Z-API] STATUS RESPONSE RAW:`, JSON.stringify(result));
      console.log(`[Z-API] CONNECTED RESULT:`, result?.connected);

      // Strict validation: Z-API returns { "connected": true } or { "connected": false }
      const isConnected = result?.connected === true;
      const status = isConnected ? 'connected' : 'disconnected';

      // Update the DB state
      await supabase
        .from("whatsapp_connections")
        .update({ 
          status, 
          connected: isConnected,
          updated_at: new Date().toISOString()
        })
        .eq("id", connectionId);

      return new Response(JSON.stringify({ 
        success: true, 
        connected: isConnected, 
        status,
        raw: result 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "set-webhook") {
      const webhookUrl = data.webhookUrl;
      const types = [
        "update-webhook-received",
        "update-webhook-disconnected",
        "update-webhook-connected",
        "update-webhook-message-status"
      ];
      
      console.log(`[Z-API] Setting webhooks to: ${webhookUrl}`);
      
      const results = await Promise.all(types.map(async (webhookType) => {
        const res = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/${webhookType}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ value: webhookUrl })
        });
        return res.json();
      }));

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "disconnect") {
      const res = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/disconnect`, {
        method: "GET",
        headers
      });
      const result = await res.json();
      
      await supabase
        .from("whatsapp_connections")
        .update({ 
          status: 'disconnected', 
          connected: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", connectionId);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Ação inválida");

  } catch (error) {
    console.error("[Z-API Edge Function] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});