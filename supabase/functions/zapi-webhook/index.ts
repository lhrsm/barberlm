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
    
    // Extrair barbershopId da URL (formato: .../zapi-webhook/[barbershopId])
    const pathParts = url.pathname.split('/');
    const barbershopIdFromUrl = pathParts[pathParts.length - 1] !== 'zapi-webhook' ? pathParts[pathParts.length - 1] : null;

    console.log("Z-API Webhook received:", JSON.stringify(body));
    console.log("BarbershopId from URL:", barbershopIdFromUrl);

    const { instanceId, type } = body;

    // Se o barbershopId estiver na URL, usamos ele. Caso contrário, tentamos achar pela instância.
    let tenantId = barbershopIdFromUrl;
    let connection = null;

    if (!tenantId) {
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("instance_id", instanceId)
        .maybeSingle();
      
      if (conn) {
        connection = conn;
        tenantId = conn.barbershop_id;
      }
    }

    if (!tenantId) {
      console.warn(`Barbearia não identificada para o evento Z-API`);
      return new Response(JSON.stringify({ status: "ignored", reason: "tenant_not_found" }), { 
        headers: corsHeaders,
        status: 200 // Z-API espera 200 para não repetir
      });
    }

    // Salvar Log do Webhook
    const { error: logError } = await supabase.from("webhook_logs").insert({
      barbershop_id: tenantId,
      event_type: type || 'Unknown',
      payload: body,
      status: 'success'
    });

    if (logError) console.error("Erro ao salvar log de webhook:", logError);

    // Processar lógica de negócio
    switch (type) {
      case "ReceivedMessage": {
        const message = body.text?.message || body.image?.caption || "Mensagem recebida";
        const from = body.phone;

        await supabase.from("whatsapp_messages").insert({
          user_id: tenantId,
          barbershop_id: tenantId,
          content: message,
          status: 'received',
          metadata: { phone: from, raw: body }
        });
        break;
      }
      case "Connected": {
        await supabase
          .from("whatsapp_connections")
          .update({ 
            status: 'connected', 
            updated_at: new Date().toISOString(),
            phone: body.phone || connection?.phone
          })
          .eq("barbershop_id", tenantId);
        break;
      }
      case "Disconnected": {
        await supabase
          .from("whatsapp_connections")
          .update({ 
            status: 'disconnected', 
            updated_at: new Date().toISOString() 
          })
          .eq("barbershop_id", tenantId);
        break;
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Retornamos 200 mesmo em erro interno para evitar retentativas infinitas da Z-API se o payload estiver correto
    });
  }
});
