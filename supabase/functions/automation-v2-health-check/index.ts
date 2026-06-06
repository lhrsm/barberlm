import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shouldNotify(lastNotified: string | null, deduplicationMinutes: number): boolean {
  if (!lastNotified) return true;
  const lastDate = new Date(lastNotified);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastDate.getTime()) / (1000 * 60);
  return diffMinutes >= deduplicationMinutes;
}

function canReprocess(lastReprocessed: string | null): boolean {
  if (!lastReprocessed) return true;
  const lastDate = new Date(lastReprocessed);
  const now = new Date();
  const diffSeconds = (now.getTime() - lastDate.getTime()) / 1000;
  return diffSeconds >= 30; // 30 second idempotency window
}

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
      
      const { data: healthSettings } = await supabase.from("system_health_settings").select("*").single();
      const { data: template } = await supabase.from("automation_templates")
        .select("id, name, last_notified_at")
        .eq("tenant_id", tenant_id)
        .eq("key", workflow_key)
        .single();

      if (template && !shouldNotify(template.last_notified_at, healthSettings?.deduplication_minutes || 60)) {
        console.log(`[HealthCheck] Notification skipped due to deduplication`);
        return new Response(JSON.stringify({ success: true, notified: false, reason: "deduplicated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenant_id).single();
      
      const message = `🚨 *ALERTA DE AUTOMAÇÃO CRÍTICO*\n\n` +
        `*Tenant:* ${tenant?.name || tenant_id}\n` +
        `*Automação:* ${template?.name || workflow_key}\n` +
        `*Erro:* WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED\n` +
        `*ID Mensagem:* ${body.provider_message_id}\n\n` +
        `O WhatsApp foi enviado com sucesso, mas o registro no banco de dados falhou. A automação foi marcada como não saudável.\n\n` +
        `🔗 [Ver Detalhes da Falha](https://painel.barbearia.com.br/admin/errors?tenant=${tenant_id}&key=${workflow_key})\n` +
        `🔗 [Ver Logs da Sessão](https://painel.barbearia.com.br/admin/logs?search=${body.provider_message_id})`;

      // Generic notification table insert
      await supabase.from("notifications").insert({
        tenant_id,
        title: "Erro Crítico de Automação",
        message: message,
        type: "critical_error",
        metadata: body
      });

      // Update last_notified_at
      if (template) {
        await supabase.from("automation_templates")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("id", template.id);
      }

      // 1. Send to Slack Webhook (Global or Specific)
      const slackWebhook = healthSettings?.slack_webhook_url || Deno.env.get("SLACK_WEBHOOK_URL");
      if (slackWebhook) {
        await fetch(slackWebhook, {
          method: 'POST',
          body: JSON.stringify({ text: message }),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 2. Send to Email targets (if infrastructure exists)
      if (healthSettings?.alert_emails && healthSettings.alert_emails.length > 0) {
        // Logic to trigger email sending function would go here
        console.log(`[HealthCheck] Would notify emails: ${healthSettings.alert_emails.join(', ')}`);
      }

      return new Response(JSON.stringify({ success: true, notified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle reprocess action
    if (action === 'reprocess') {
      const { data: template } = await supabase.from("automation_templates")
        .select("id, last_reprocessed_at, reprocessing_status")
        .eq("tenant_id", tenant_id)
        .eq("key", workflow_key)
        .single();

      if (!template) {
        return new Response(JSON.stringify({ success: false, error: "Template not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Idempotency Check
      if (!canReprocess(template.last_reprocessed_at) || template.reprocessing_status === 'processing') {
        return new Response(JSON.stringify({ success: false, error: "REPROCESS_ALREADY_IN_PROGRESS", last_reprocessed: template.last_reprocessed_at }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Mark as processing
      await supabase.from("automation_templates")
        .update({ 
          reprocessing_status: 'processing', 
          last_reprocessed_at: new Date().toISOString() 
        })
        .eq("id", template.id);

      // 3. Trigger async job (invoke queue processor)
      // Note: We don't await the full result here to keep it async for the UI
      edge_function_invoke_queue(supabase, tenant_id, workflow_key, template.id);

      return new Response(JSON.stringify({ success: true, status: 'processing' }), {
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