import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { action, tenant_id, workflow_key, check_all = false } = body;

    // Handle internal notification trigger
    if (action === 'notify_unhealthy') {
      console.log(`[HealthCheck] Notification trigger for ${tenant_id} / ${workflow_key}`);
      
      const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenant_id).single();
      
      const message = `🚨 *ALERTA DE AUTOMAÇÃO CRÍTICO*\n\n` +
        `*Tenant:* ${tenant?.name || tenant_id}\n` +
        `*Automação:* ${workflow_key}\n` +
        `*Erro:* WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED\n` +
        `*ID Mensagem:* ${body.provider_message_id}\n\n` +
        `O WhatsApp foi enviado com sucesso, mas o registro no banco de dados falhou. A automação foi marcada como não saudável.\n\n` +
        `🔗 [Ver Histórico](https://painel.barbearia.com.br/admin/automation-health?tenant=${tenant_id})\n` +
        `🔗 [Ver Logs](https://painel.barbearia.com.br/admin/logs?search=${body.provider_message_id})`;

      // Generic notification table insert (common pattern in this project)
      await supabase.from("notifications").insert({
        tenant_id,
        title: "Erro Crítico de Automação",
        message: message,
        type: "critical_error",
        metadata: body
      });

      // If Slack webhook exists in env, send there too
      const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
      if (slackWebhook) {
        await fetch(slackWebhook, {
          method: 'POST',
          body: JSON.stringify({ text: message }),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, notified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard Health Check Logic
    let query = supabase.from("automation_templates").select("*, tenant:tenants(name)");
    
    if (tenant_id) {
      query = query.eq("tenant_id", tenant_id);
    } else if (!check_all) {
      query = query.eq("is_healthy", false);
    }

    const { data: automations, error: autoError } = await query;
    if (autoError) throw autoError;

    const report = [];

    for (const automation of automations || []) {
      const { data: logs } = await supabase
        .from("automation_v2_logs")
        .select("*")
        .eq("tenant_id", automation.tenant_id)
        .or(`message.eq.WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED,message.ilike.%${automation.key}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      const criticalLogs = logs?.filter(l => l.message === "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED") || [];
      
      const issues = [];
      if (criticalLogs.length > 0) {
        issues.push({
          type: "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED",
          count: criticalLogs.length,
          last_occurrence: criticalLogs[0].created_at,
          details: criticalLogs[0].context
        });
      }

      const sentLogs = logs?.filter(l => l.message.includes("Mensagem enviada")) || [];
      for (const log of sentLogs) {
          const providerId = log.context?.provider_message_id;
          if (providerId) {
              const { data: dispatch } = await supabase
                  .from("automation_v2_dispatches")
                  .select("id")
                  .eq("provider_message_id", providerId)
                  .maybeSingle();
              
              if (!dispatch) {
                  issues.push({
                      type: "DISPATCH_MISSING_FOR_SENT_MESSAGE",
                      provider_message_id: providerId,
                      log_time: log.created_at
                  });
              }
          }
      }

      report.push({
        automation_id: automation.id,
        key: automation.key,
        tenant_id: automation.tenant_id,
        tenant_name: automation.tenant?.name || "N/A",
        is_healthy: automation.is_healthy,
        last_error: automation.last_error,
        issues: issues
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      timestamp: new Date().toISOString(),
      summary: {
        total_checked: report.length,
        unhealthy: report.filter(r => !r.is_healthy).length,
        issues_detected: report.some(r => r.issues.length > 0)
      },
      report 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[HealthCheck] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});