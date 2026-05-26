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

    const instanceId = connection.instance_id || Deno.env.get("ZAPI_INSTANCE_ID");
    const token = connection.instance_token || Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const baseUrl = connection.server_url || "https://api.z-api.io";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    if (action === "check-status") {
      console.log(`Checking status for instance ${instanceId}`);
      const res = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/status`, {
        method: "GET",
        headers
      });
      
      const result = await res.json();
      console.log(`Status result:`, JSON.stringify(result));

      const isConnected = result.connected === true || 
                        result.connected === 'true' || 
                        result.value === 'CONNECTED' ||
                        result.status === 'CONNECTED' ||
                        result.status === 'connected';

      const status = isConnected ? 'connected' : 'disconnected';

      // Update both tables
      await Promise.all([
        supabase
          .from("whatsapp_connections")
          .update({ 
            status, 
            connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq("id", connectionId),
        
        supabase
          .from("whatsapp_instances")
          .update({ 
            status, 
            connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq("barber_id", connection.barber_id)
      ]);

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
        "update-webhook-message-status",
        "update-webhook-chat-state"
      ];
      
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
      
      const status = 'disconnected';
      await Promise.all([
        supabase
          .from("whatsapp_connections")
          .update({ status, connected: false })
          .eq("id", connectionId),
        supabase
          .from("whatsapp_instances")
          .update({ status, connected: false })
          .eq("barber_id", connection.barber_id)
      ]);

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
