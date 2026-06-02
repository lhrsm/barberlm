import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processAutomationTemplate } from "../_shared/template-parser.ts";
import { normalizePhone } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  
  // Se tiver 10 ou 11 dígitos, assume que falta o DDI 55
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  
  // Tratamento especial para números do Brasil (DDI 55)
  // Remove o nono dígito se presente para padronizar a busca/armazenamento
  if (digits.startsWith("55") && digits.length === 13) {
    digits = digits.substring(0, 4) + digits.substring(5);
  }
  
  return digits;
}

serve(async (req) => {
  console.log('EDGE FUNCTION STARTED: test-automation');
  console.log('REQUEST METHOD:', req.method);

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

    // BUSCA SEMPRE CONFIGURAÇÃO ATUAL DO BANCO (SINGLE SOURCE OF TRUTH)
    const { data: settings } = await supabase
      .from("barbershop_settings")
      .select("*")
      .eq("barber_id", tenantId)
      .maybeSingle();

    let connection = settings;

    if (!connection) {
      console.log(`[Test] No settings found in barbershop_settings. Checking legacy...`);
      const { data: legacyConn } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .or(`tenant_id.eq.${tenantId},barbershop_id.eq.${tenantId}`)
        .maybeSingle();
      
      if (!legacyConn) {
        throw new Error("WhatsApp principal da barbearia não configurado (Single source missing).");
      }
      connection = legacyConn;
    }

    // Live check
    console.log(`[Test] Performing live check for instance ${connection.instance_id}...`);
    const statusUrl = `${connection.server_url || "https://api.z-api.io"}/instances/${connection.instance_id}/token/${connection.instance_token}/status`;
    const statusHeaders: any = { "Content-Type": "application/json" };
    if (connection.client_token) {
      statusHeaders["client-token"] = connection.client_token;
    }
    const statusRes = await fetch(statusUrl, { method: "GET", headers: statusHeaders });
    const statusData = await statusRes.json();
    console.log(`[Test] INSTANCE ID: ${connection.instance_id}`);
    console.log(`[Test] TOKEN: ${connection.instance_token}`);
    console.log(`[Test] STATUS RESPONSE RAW:`, JSON.stringify(statusData));
    console.log(`[Test] CONNECTED RESULT:`, statusData?.connected);

    if (statusData?.connected !== true) {
      throw new Error("WhatsApp principal da barbearia não conectado na Z-API (Validado via /status).");
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
    const baseUrl = connection.server_url || "https://api.z-api.io";

    const headers: any = { 
      "Content-Type": "application/json" 
    };
    if (connection.client_token) {
      headers["client-token"] = connection.client_token;
    }

    let zapiResult: any = {};
    let ok = false;

    try {
      const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
      console.log(`[Test] Sending to ${targetPhone} via ${sendUrl}`);
      const response = await fetch(sendUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: normalizePhone(targetPhone),
          message: processedMessage
        })
      });

      zapiResult = await response.json();
      console.log(`[Test] ZAPI SEND RESPONSE:`, JSON.stringify(zapiResult));
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