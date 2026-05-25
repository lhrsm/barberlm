
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

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { action, connectionId, instanceName, serverUrl, apiKey, data } = await req.json();

    // If connectionId is provided, fetch it to get credentials
    let credentials = { instanceName, serverUrl, apiKey };
    if (connectionId) {
      const { data: conn, error: connError } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("barbershop_id", user.id)
        .single();
      
      if (connError || !conn) throw new Error("Connection not found");
      credentials = {
        instanceName: conn.instance_name,
        serverUrl: conn.server_url,
        apiKey: conn.api_key
      };
    }

    const { instanceName: inst, serverUrl: url, apiKey: key } = credentials;
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;

    console.log(`Evolution API Action: ${action} for instance: ${inst}`);

    let response;
    switch (action) {
      case 'get-qrcode':
        response = await fetch(`${baseUrl}/instance/connect/${inst}`, {
          headers: { "apikey": key }
        });
        break;
      
      case 'get-status':
        response = await fetch(`${baseUrl}/instance/connectionState/${inst}`, {
          headers: { "apikey": key }
        });
        break;

      case 'logout':
        response = await fetch(`${baseUrl}/instance/logout/${inst}`, {
          method: 'DELETE',
          headers: { "apikey": key }
        });
        break;

      case 'delete-instance':
        response = await fetch(`${baseUrl}/instance/delete/${inst}`, {
          method: 'DELETE',
          headers: { "apikey": key }
        });
        break;

      case 'test-connection':
        // Send a simple text message to the provided number
        response = await fetch(`${baseUrl}/message/sendText/${inst}`, {
          method: 'POST',
          headers: { 
            "apikey": key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            number: data.number,
            text: "Teste de conexão BarberLM SaaS 🚀"
          })
        });
        break;

      case 'set-webhook':
        response = await fetch(`${baseUrl}/webhook/set/${inst}`, {
          method: 'POST',
          headers: { 
            "apikey": key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: data.webhookUrl,
            enabled: true,
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE"
            ]
          })
        });
        break;

      default:
        throw new Error("Invalid action");
    }

    const result = await response.json();
    console.log(`Evolution API Result for ${action}:`, result);

    // If action was get-status and it's connected, update the database
    if (action === 'get-status' && result.instance?.state === 'open' && connectionId) {
      await supabase
        .from("whatsapp_connections")
        .update({ 
          status: 'connected', 
          last_connection: new Date().toISOString() 
        })
        .eq("id", connectionId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Evolution API Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
