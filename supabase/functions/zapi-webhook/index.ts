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
    
    const pathParts = url.pathname.split('/');
    const tenantIdFromUrl = pathParts[pathParts.length - 1] !== 'zapi-webhook' ? pathParts[pathParts.length - 1] : null;

    console.log("Z-API Webhook received:", JSON.stringify(body));

    const { instanceId, type, phone } = body;

    let tenantId = tenantIdFromUrl;
    let instance = null;

    if (!tenantId) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("instance_id", instanceId)
        .maybeSingle();
      
      if (inst) {
        instance = inst;
        tenantId = inst.tenant_id;
      }
    }

    if (!tenantId) {
      console.warn(`Tenant não identificado para o evento Z-API instance ${instanceId}`);
      return new Response(JSON.stringify({ status: "ignored", reason: "tenant_not_found" }), { 
        headers: corsHeaders,
        status: 200 
      });
    }

    await supabase.from("automation_logs").insert({
      barber_id: tenantId,
      status: 'received',
      message_type: type || 'webhook_event',
      phone: phone || body.phone,
      response: body
    });

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
      console.log(`Updating status for tenant ${tenantId} to ${status}`);
      
      await supabase
        .from("whatsapp_instances")
        .update({ 
          status, 
          connected: isConnected,
          phone: phone || body.phone,
          updated_at: new Date().toISOString()
        })
        .eq("tenant_id", tenantId);
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
