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

    const bodyData = await req.json();
    const { action, connectionId, data } = bodyData;

    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    const instanceId = String(connection.instance_id).trim();
    const token = String(connection.instance_token).trim();
    
    const rawServerUrl = (connection.server_url || "https://api.z-api.io").trim();
    let baseUrl = rawServerUrl;
    if (rawServerUrl.includes('/instances/')) {
      baseUrl = rawServerUrl.split('/instances/')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, "");

    const headers = {
      "Content-Type": "application/json",
    };

    let endpoint = "";
    let method = "GET";
    let body = undefined;

    switch (action) {
      case "get-qrcode":
        endpoint = `/instances/${instanceId}/token/${token}/qr-code`;
        break;
      case "get-status":
      case "test-connection":
        endpoint = `/instances/${instanceId}/token/${token}/status`;
        break;
      case "get-pairing-code":
        endpoint = `/instances/${instanceId}/token/${token}/pairing-code?phone=${data.phone}`;
        break;
      case "get-connection-link":
        endpoint = `/instances/${instanceId}/token/${token}/connection-link`;
        break;
      case "disconnect":
        endpoint = `/instances/${instanceId}/token/${token}/disconnect`;
        break;
      case "set-webhook": {
        const webhookUrl = data.webhookUrl;
        const types = [
          "update-webhook-received",
          "update-webhook-disconnected",
          "update-webhook-connected",
          "update-webhook-message-status",
          "update-webhook-chat-state"
        ];
        
        const webhookResults = await Promise.all(types.map(async (webhookType) => {
          const res = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/${webhookType}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ value: webhookUrl })
          });
          return res.json();
        }));

        return new Response(JSON.stringify({ success: true, results: webhookResults }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      default:
        throw new Error("Ação inválida");
    }

    const fullUrl = `${baseUrl}${endpoint}`;
    
    console.log('--- DEBUG REAIS HEADERS ---');
    console.log('URL:', fullUrl);
    console.log('METHOD:', method);
    console.log('HEADERS:', JSON.stringify(headers));

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('Z-API RAW RESPONSE:', responseText);

    if (!response.ok) {
      throw new Error(`Z-API Error: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);

    if (action === "get-status" || action === "test-connection") {
      const isConnected = result.connected === true || result.connected === 'true';
      let status = isConnected ? "connected" : (result.waitingQrCode ? "qrcode" : "disconnected");

      await supabase
        .from("whatsapp_connections")
        .update({ 
          status, 
          connected: isConnected,
          phone: result.phone || connection.phone,
          instance_name: result.instanceName || connection.instance_name,
          updated_at: new Date().toISOString(),
          last_connection: isConnected ? new Date().toISOString() : undefined
        })
        .eq("id", connectionId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Z-API Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});