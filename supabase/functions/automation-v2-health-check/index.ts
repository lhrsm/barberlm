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
    const { check_all = false } = await req.json().catch(() => ({}));

    // 1. Get unhealthy automations
    let query = supabase.from("automation_templates").select("*, tenant:tenants(name)");
    
    if (!check_all) {
      query = query.eq("is_healthy", false);
    }

    const { data: automations, error: autoError } = await query;
    if (autoError) throw autoError;

    const report = [];

    for (const automation of automations || []) {
      const issues = [];
      
      // Check for specific critical error in logs
      const { data: logs, error: logError } = await supabase
        .from("automation_v2_logs")
        .select("*")
        .eq("tenant_id", automation.tenant_id)
        .eq("message", "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED")
        .order("created_at", { ascending: false })
        .limit(5);

      if (logs && logs.length > 0) {
        issues.push({
          type: "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED",
          count: logs.length,
          last_occurrence: logs[0].created_at,
          details: logs[0].context
        });
      }

      // Check for missed dispatches: messages sent according to logs but no dispatch entry
      // This is a more complex cross-check
      const { data: sentLogs } = await supabase
        .from("automation_v2_logs")
        .select("*")
        .eq("tenant_id", automation.tenant_id)
        .ilike("message", "Mensagem enviada%")
        .order("created_at", { ascending: false })
        .limit(20);

      for (const log of sentLogs || []) {
        const providerId = log.context?.provider_message_id;
        if (providerId) {
          const { data: dispatch } = await supabase
            .from("automation_v2_dispatches")
            .select("id")
            .eq("provider_message_id", providerId)
            .maybeSingle();

          if (!dispatch) {
            issues.push({
              type: "ORPHAN_LOG_NO_DISPATCH",
              log_id: log.id,
              provider_message_id: providerId,
              created_at: log.created_at
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
        issues
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      timestamp: new Date().toISOString(),
      summary: {
        total_checked: report.length,
        unhealthy: report.filter(r => !r.is_healthy).length,
        critical_issues: report.reduce((acc, r) => acc + r.issues.length, 0)
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