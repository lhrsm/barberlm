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
    const { tenant_id, check_all = false } = await req.json().catch(() => ({}));

    // 1. Get unhealthy automations
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
      // Find logs related to this automation
      const { data: logs } = await supabase
        .from("automation_v2_logs")
        .select("*")
        .eq("tenant_id", automation.tenant_id)
        .or(`message.eq.WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED,message.ilike.%${automation.key}%`)
        .order("created_at", { ascending: false })
        .limit(10);

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

      // Check if is_healthy matches the log state
      const shouldBeHealthy = criticalLogs.length === 0;
      
      // Verification logic: look for "Mensagem enviada" without a corresponding dispatch
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
        tenant_name: automation.tenant?.name || "N/A",
        is_healthy: automation.is_healthy,
        last_error: automation.last_error,
        should_be_healthy: shouldBeHealthy && issues.length === 0,
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