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

    // 1. Buscar a conexão no banco
    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    const { instance_id, instance_token, server_url } = connection;
    const baseUrl = (server_url || "https://api.z-api.io").replace(/\/$/, "");

    const headers: any = {
      "Content-Type": "application/json",
    };

    let endpoint = "";
    let method = "GET";
    let body = undefined;

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
        endpoint = `/instances/${instance_id}/token/${instance_token}/status`;
        method = "GET";
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
        
        console.log('--- SET WEBHOOK DEBUG ---');
        console.log('HEADERS ENVIADOS:', JSON.stringify(headers));

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

    const fullUrl = `${baseUrl}${endpoint}`;
    
    // DEBUG OBRIGATÓRIO
    console.log('--- DEBUG Z-API REQUEST ---');
    console.log('URL:', fullUrl);
    console.log('METHOD:', method);
    console.log('HEADERS ENVIADOS:', JSON.stringify(headers));
    if (body) console.log('BODY:', JSON.stringify(body));

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('Z-API RAW RESPONSE:', responseText);

    if (!response.ok) {
      if (responseText.includes('client-token')) {
        console.error('ERRO CRÍTICO: Z-API reclama de client-token mesmo sem enviarmos o header!');
      }
      throw new Error(`Z-API Error: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('STATUS DATA:', result);

    if (action === "get-status" || action === "test-connection") {
      const isConnected = 
        result.connected === true || 
        result.connected === 'true';

      let status = "disconnected";
      if (isConnected) status = "connected";
      else if (result.waitingQrCode) status = "qrcode";

      console.log('Determined status:', status);

      const updateData: any = { 
        status, 
        connected: isConnected,
        phone: result.phone || connection.phone,
        instance_name: result.instanceName || connection.instance_name,
        updated_at: new Date().toISOString() 
      };

      if (isConnected) {
        updateData.last_connection = new Date().toISOString();
      }

      await supabase
        .from("whatsapp_connections")
        .update(updateData)
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