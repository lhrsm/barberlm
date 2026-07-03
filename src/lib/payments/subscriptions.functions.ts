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
 * Normaliza telefone (só dígitos) — mesma lógica do portal do cliente.
 */
function normalizePhone(p: string): string {
  return String(p ?? "").replace(/\D+/g, "");
}

/**
 * Cria uma assinatura para o cliente final usando o gateway PRINCIPAL da barbearia.
 *
 * SEGURANÇA: endpoint público, mas exige que o chamador prove ser o cliente
 * enviando `phone`. Validamos que o telefone bate com customers.phone daquele
 * tenant e com client_auth (mesmo contrato do login do portal). Sem essa
 * validação, qualquer um poderia criar assinaturas em nome de terceiros.
 */
export const createCustomerSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: {
    tenantId: string;
    planId: string;
    phone: string;
    email?: string;
    returnUrl: string;
  }) => {
    if (!data.tenantId || !data.planId || !data.phone || !data.returnUrl) {
      throw new Error("tenantId, planId, phone e returnUrl são obrigatórios");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    if (phone.length < 8) throw new Error("Telefone inválido");

    // 1. Autentica o cliente: phone tem que existir neste tenant E ter client_auth
    const { data: customer, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("id, name, email, phone, user_id")
      .eq("user_id", data.tenantId)
      .eq("phone", phone)
      .maybeSingle();

    if (custErr || !customer) {
      throw new Error("Cliente não encontrado. Faça login no portal primeiro.");
    }

    const { data: auth } = await supabaseAdmin
      .from("client_auth")
      .select("customer_id")
      .eq("phone", phone)
      .maybeSingle();

    if (!auth) {
      throw new Error("Sessão do cliente inválida. Faça login no portal primeiro.");
    }

    const customerId = (customer as any).id;

    // 2. Idempotência: já existe assinatura ativa/pendente do mesmo cliente+plano?
    const { data: existing } = await supabaseAdmin
      .from("customer_subscriptions")
      .select("id, status, metadata")
      .eq("tenant_id", data.tenantId)
      .eq("customer_id", customerId)
      .eq("plan_id", data.planId)
      .in("status", ["active", "pending_payment", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const existingUrl = (existing as any).metadata?.checkout_url;
      if ((existing as any).status === "pending_payment" && existingUrl) {
        // reaproveita checkout pendente
        return { checkoutUrl: existingUrl, provider: null, reused: true };
      }
      throw new Error(
        (existing as any).status === "active"
          ? "Você já tem uma assinatura ativa neste plano."
          : "Já existe uma solicitação de assinatura em andamento."
      );
    }

    // 3. Gateway principal ativo da barbearia
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

    // 4. Plano
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, monthly_price")
      .eq("id", data.planId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    if (planErr || !plan) throw new Error("Plano não encontrado.");

    const provider = getProvider((gw as any).provider as ProviderKey);
    if (!provider.createSubscription) {
      throw new Error(`Provider ${provider.displayName} ainda não suporta assinaturas via API.`);
    }

    // 5. Cria no provider
    const resolvedEmail = data.email ?? (customer as any).email;
    console.log("[createCustomerSubscription] input", {
      tenantId: data.tenantId,
      customerId,
      planId: data.planId,
      provider: (gw as any).provider,
      environment: (gw as any).environment,
      hasAccessToken: !!(gw as any).credentials?.access_token,
      hasPublicKey: !!(gw as any).credentials?.public_key,
      planName: (plan as any).name,
      amount: Number((plan as any).monthly_price),
      resolvedEmail,
      returnUrl: data.returnUrl,
    });

    let result;
    try {
      result = await provider.createSubscription({
        gateway: gw as unknown as PaymentGatewayRow,
        tenantId: data.tenantId,
        customer: {
          id: customerId,
          name: (customer as any).name,
          email: resolvedEmail,
          phone,
        },
        plan: {
          id: (plan as any).id,
          name: (plan as any).name,
          amount: Number((plan as any).monthly_price),
          currency: "BRL",
          intervalMonths: 1,
        },
        returnUrl: data.returnUrl,
        metadata: { tenant_id: data.tenantId, customer_id: customerId },
      });
    } catch (err: any) {
      console.error("[createCustomerSubscription] provider error", {
        provider: (gw as any).provider,
        message: err?.message,
        stack: err?.stack,
      });
      // Log em payment_gateway_logs para auditoria
      await supabaseAdmin.from("payment_gateway_logs").insert({
        tenant_id: data.tenantId,
        gateway_id: (gw as any).id,
        event: "create_subscription",
        status: "error",
        message: String(err?.message ?? err).slice(0, 500),
      });
      throw new Error(err?.message ?? "Falha ao criar assinatura");
    }

    // 6. Registra em customer_subscriptions (pending_payment até webhook confirmar)
    await supabaseAdmin.from("customer_subscriptions").insert({
      tenant_id: data.tenantId,
      customer_id: customerId,
      plan_id: (plan as any).id,
      status: "pending_payment",
      payment_method: (gw as any).provider,
      provider: (gw as any).provider,
      provider_subscription_id: result.providerSubscriptionId,
      gateway_id: (gw as any).id,
      amount: Number((plan as any).monthly_price),
      currency: "BRL",
      metadata: { checkout_url: result.checkoutUrl },
    } as any);

    return {
      checkoutUrl: result.checkoutUrl,
      providerSubscriptionId: result.providerSubscriptionId,
      provider: (gw as any).provider,
      reused: false,
    };
  });
