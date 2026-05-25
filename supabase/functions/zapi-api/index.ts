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
        
        // Configura todos os webhooks necessários na Z-API
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
      default:
        throw new Error("Ação inválida");
    }

    console.log(`instanceId ${instance_id}`);
    console.log(`token ${instance_token}`);
    console.log(`clientToken ${client_token}`);
    console.log(`Z-API Request: ${method} ${baseUrl}${endpoint}`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body,
    });

    const result = await response.json();
    console.log('instanceId', instance_id);
    console.log('token', instance_token);
    console.log('clientToken', client_token);
    console.log('qrCodeResponse', action === 'get-qrcode' ? result : 'N/A');
    console.log('statusResponse', action === 'get-status' ? result : 'N/A');
    console.log(`Z-API Response:`, result);

    // Se for status, vamos atualizar o banco
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
