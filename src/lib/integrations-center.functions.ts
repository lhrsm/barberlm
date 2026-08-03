import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/**
 * Mapeamento de Saúde das Integrações
 * Este arquivo atua como o adapter para monitoramento centralizado.
 */

export const getIntegrationHealth = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    
    // 1. Z-API Health (via whatsapp_instances)
    const { data: profile } = await admin
      .from("profiles")
      .select("whatsapp_enabled")
      .eq("id", data.tenantId)
      .maybeSingle();

    const { data: whatsappInstances } = await admin
      .from("whatsapp_instances")
      .select("id, status, updated_at")
      .eq("tenant_id", data.tenantId)
      .limit(1);

    // 2. Stripe/Mercado Pago Gateways
    const { data: gateways } = await admin
      .from("payment_gateways")
      .select("id, provider, status, environment, last_sync_at")
      .eq("tenant_id", data.tenantId);

    // 3. Automation Queue/Logs
    const { data: logs } = await admin
      .from("automation_logs")
      .select("status")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    const instance = whatsappInstances?.[0];
    const whatsappStatus = profile?.whatsapp_enabled && instance ? "active" : "not_configured";

    const recentFailures = (logs || []).filter((l: any) => l.status === 'error').length;

    return {
      whatsapp: {
        status: whatsappStatus,
        health: recentFailures > 3 ? "degraded" : "healthy",
        lastActivity: new Date().toISOString()
      },
      payments: gateways?.map((g: any) => ({
        id: g.id,
        provider: g.provider,
        status: g.status === 'connected' ? 'active' : 'error',
        environment: g.environment,
        lastSync: g.last_sync_at
      })) || [],
      timestamp: new Date().toISOString()
    };
  });

export const testIntegration = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    tenantId: z.string(),
    integrationKey: z.string() 
  }).parse(data))
  .handler(async ({ data }) => {
    // Implementação mockada inicial para a Central
    await new Promise(r => setTimeout(r, 1500));
    return { ok: true, message: `Teste concluído para ${data.integrationKey}` };
  });
