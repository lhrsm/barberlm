import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { automationId, automationType, template, phone: testPhone } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (!user) throw new Error("Não autorizado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.tenant_id || profile?.id;
    if (!tenantId) throw new Error("Tenant não encontrado");

    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .maybeSingle();

    if (!connection) {
      throw new Error("WhatsApp principal da barbearia não conectado. Por favor, conecte o WhatsApp nas configurações da barbearia.");
    }

    const { data: appt } = await supabase
      .from("appointments")
      .select("*, customers(*), barbers:barber_id(*), profiles:tenant_id(*), services:service_id(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mockData = {
      cliente_nome: appt?.customers?.name || appt?.name || "João da Silva",
      barbearia_nome: appt?.profiles?.business_name || connection.instance_name || "Sua Barbearia",
      data: appt ? new Date(appt.start_time).toLocaleDateString('pt-BR') : "26/05/2026",
      horario: appt ? new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "14:30",
      profissional: appt?.barbers?.name || appt?.profiles?.responsible_name || "Seu Barbeiro",
      servico: appt?.services?.name || "Corte Social",
    };

    const processedMessage = processAutomationTemplate(template, mockData);

    const targetPhone = testPhone || connection.phone || "5571999999999"; 

    const instanceId = connection.instance_id;
    const token = connection.instance_token;
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const baseUrl = connection.server_url || "https://api.z-api.io";

    const headers: any = { 
      "Content-Type": "application/json" 
    };
    
    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    let zapiResult: any = {};
    let ok = false;

    try {
      const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: normalizePhone(targetPhone),
          message: processedMessage
        })
      });

      zapiResult = await response.json();
      ok = response.ok;
    } catch (fetchErr) {
      zapiResult = { error: fetchErr.message };
      ok = false;
    }

    await supabase.from("automation_logs").insert({
      automation_id: automationId,
      tenant_id: tenantId,
      barber_id: user.id,
      status: ok ? "success" : "error",
      message_type: automationType + "_test",
      phone: normalizePhone(targetPhone),
      original_template: template,
      processed_template: processedMessage,
      response: zapiResult,
      error_message: ok ? null : (zapiResult.message || zapiResult.error || "Erro na Z-API"),
      sent_at: new Date().toISOString()
    });

    if (!ok) {
      throw new Error(zapiResult.message || zapiResult.error || "Erro na Z-API");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processedMessage,
      zapiResult 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Test Automation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});