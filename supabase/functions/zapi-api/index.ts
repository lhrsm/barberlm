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

    const { action, instanceId: tableId, data } = await req.json();

    const { data: instance, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", tableId)
      .single();

    if (instError || !instance) {
      throw new Error("Instância não encontrada");
    }

    const instanceId = instance.instance_id;
    const token = instance.token;
    const clientToken = instance.client_token;
    const baseUrl = instance.server_url || "https://api.z-api.io";

    console.log(`[Z-API] Action: ${action} | Instance: ${instanceId}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    if (action === "check-status") {
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/status`;
      const res = await fetch(url, { method: "GET", headers });
      const result = await res.json();

      const isConnected = result?.connected === true;
      const status = isConnected ? 'connected' : 'disconnected';

      await supabase
        .from("whatsapp_instances")
        .update({ 
          status, 
          connected: isConnected,
          updated_at: new Date().toISOString()
        })
        .eq("id", tableId);

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

    if (action === "update-webhook-received") {
      const webhookUrl = data.webhookUrl;
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/update-webhook-received`;
      
      console.log(`[Z-API] Updating received webhook to: ${webhookUrl}`);
      
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: webhookUrl })
      });
      
      const result = await res.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "get-webhooks") {
      const url = `${baseUrl}/instances/${instanceId}/token/${token}/webhooks`;
      const res = await fetch(url, { method: "GET", headers });
      const result = await res.json();

      return new Response(JSON.stringify({ success: true, result }), {
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
      
      const results = await Promise.all(types.map(async (webhookType) => {
        // We use PUT here as per recent Z-API requirements for webhook updates
        const res = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/${webhookType}`, {
          method: "PUT",
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
        .from("whatsapp_instances")
        .update({ 
          status: 'disconnected', 
          connected: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", tableId);

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
