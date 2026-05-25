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

    // 1. Buscar a conexão no banco
    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    const { instance_id, instance_token, server_url, client_token } = connection;
    const baseUrl = server_url || "https://api.z-api.io";

    const headers: any = {
      "Content-Type": "application/json",
    };

    if (client_token) {
      headers["Client-Token"] = client_token;
    }

    let endpoint = "";
    let method = "GET";
    let body = null;

    switch (action) {
      case "get-qrcode":
        endpoint = `/instances/${instance_id}/token/${instance_token}/qr-code`;
        break;
      case "get-status":
        endpoint = `/instances/${instance_id}/token/${instance_token}/status`;
        break;
      case "get-pairing-code":
        endpoint = `/instances/${instance_id}/token/${instance_token}/pairing-code?phone=${data.phone}`;
        break;
      case "get-connection-link":
        endpoint = `/instances/${instance_id}/token/${instance_token}/connection-link`;
        break;
      case "disconnect":
        endpoint = `/instances/${instance_id}/token/${instance_token}/disconnect`;
        break;
      case "test-connection":
        endpoint = `/instances/${instance_id}/token/${instance_token}/send-text`;
        method = "POST";
        body = JSON.stringify({
          phone: data.number,
          message: "BarberLM: Teste de conexão Z-API realizado com sucesso! 🚀"
        });
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
          const res = await fetch(`${baseUrl}/instances/${instance_id}/token/${instance_token}/${webhookType}`, {
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
      case "test-webhook": {
        const webhookUrl = data.webhookUrl;
        const testPayload = {
          instanceId: connection.instance_id,
          type: "WebhookTest",
          data: { message: "Teste de comunicação bem sucedido!" },
          timestamp: new Date().toISOString()
        };
        
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload)
        });
        
        return new Response(JSON.stringify({ 
          success: res.ok, 
          status: res.status,
          message: res.ok ? "Webhook respondeu corretamente!" : "Webhook retornou erro."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      default:
        throw new Error("Ação inválida");
    }

    console.log(`Z-API Request: ${method} ${baseUrl}${endpoint}`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body,
    });

    const result = await response.json();
    console.log(`Z-API Response:`, result);

    if (action === "get-status") {
      let status = "disconnected";
      if (result.connected) status = "connected";
      else if (result.waitingQrCode) status = "qrcode";

      await supabase
        .from("whatsapp_connections")
        .update({ 
          status, 
          phone: result.phone || connection.phone,
          instance_name: result.instanceName || connection.instance_name,
          updated_at: new Date().toISOString() 
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