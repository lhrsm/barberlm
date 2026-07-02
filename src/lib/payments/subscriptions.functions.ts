import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider } from "./providers/index.server";
import type { PaymentGatewayRow, ProviderKey } from "./types";

/**
 * Testa a conexão com o gateway do tenant chamando o provider real.
 * Retorna { ok, message } e atualiza status/last_sync_at na tabela.
 */
export const testGatewayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { gatewayId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: gw, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("id", data.gatewayId)
      .eq("tenant_id", userId)
      .maybeSingle();

    if (error || !gw) return { ok: false, message: "Gateway não encontrado" };

    const provider = getProvider((gw as any).provider as ProviderKey);
    const result = await provider.testConnection(gw as unknown as PaymentGatewayRow);

    await supabase
      .from("payment_gateways")
      .update({
        status: result.ok ? "connected" : "error",
        status_message: result.message,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", (gw as any).id);

    await supabase.from("payment_gateway_logs").insert({
      tenant_id: userId,
      gateway_id: (gw as any).id,
      event: "connection_test",
      status: result.ok ? "success" : "error",
      message: result.message,
    });

    return { ok: result.ok, message: result.message, accountName: result.accountName };
  });

/**
 * Cria uma assinatura para o cliente final usando o gateway PRINCIPAL da barbearia.
 * Chamado pelo checkout público (fluxo do cliente final da barbearia).
 */
export const createCustomerSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: {
    tenantId: string;
    planId: string;
    customer: { id: string; name?: string; email?: string; document?: string; phone?: string };
    returnUrl: string;
  }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Gateway principal ativo da barbearia
    const { data: gw, error: gwErr } = await supabaseAdmin
      .from("payment_gateways")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle();

    if (gwErr || !gw) {
      throw new Error("Esta barbearia ainda não configurou um gateway de pagamento.");
    }

    // 2. Plano
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, price, currency, billing_cycle")
      .eq("id", data.planId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    if (planErr || !plan) throw new Error("Plano não encontrado.");

    const provider = getProvider((gw as any).provider as ProviderKey);
    if (!provider.createSubscription) {
      throw new Error(`Provider ${provider.displayName} ainda não suporta assinaturas via API.`);
    }

    // 3. Cria no provider
    const result = await provider.createSubscription({
      gateway: gw as unknown as PaymentGatewayRow,
      tenantId: data.tenantId,
      customer: data.customer,
      plan: {
        id: (plan as any).id,
        name: (plan as any).name,
        amount: Number((plan as any).price),
        currency: (plan as any).currency ?? "BRL",
        intervalMonths: 1,
      },
      returnUrl: data.returnUrl,
      metadata: { tenant_id: data.tenantId, customer_id: data.customer.id },
    });

    // 4. Registra em customer_subscriptions (pending_payment até webhook confirmar)
    await supabaseAdmin.from("customer_subscriptions").insert({
      tenant_id: data.tenantId,
      customer_id: data.customer.id,
      plan_id: (plan as any).id,
      status: "pending_payment",
      payment_method: (gw as any).provider,
      provider: (gw as any).provider,
      provider_subscription_id: result.providerSubscriptionId,
      gateway_id: (gw as any).id,
      amount: Number((plan as any).price),
      currency: (plan as any).currency ?? "BRL",
      metadata: { checkout_url: result.checkoutUrl },
    } as any);

    return {
      checkoutUrl: result.checkoutUrl,
      providerSubscriptionId: result.providerSubscriptionId,
      provider: (gw as any).provider,
    };
  });
