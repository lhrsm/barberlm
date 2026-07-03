import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGatewayRow,
  PaymentProvider,
  TestConnectionResult,
  WebhookEvent,
} from "../types";
import { apiFetch, requireCred, requireHttpsUrl } from "./_shared";

/**
 * PayPal Subscriptions API.
 * Docs: https://developer.paypal.com/docs/api/subscriptions/v1/
 *
 * Fluxo:
 * 1. OAuth2 -> access_token
 * 2. Cria Product (catalog/products) — idempotente por metadata.plan_id
 * 3. Cria Plan (billing/plans) mensal
 * 4. Cria Subscription (billing/subscriptions) -> approve link
 *
 * Webhook: header `paypal-transmission-sig` + certificado. Como validar cert
 * server-side no Worker é caro (baixar cert PayPal), usamos webhook_secret =
 * webhook_id do PayPal e endpoint `/notifications/verify-webhook-signature`
 * pra fazer a validação delegada.
 */

function baseUrl(gw: PaymentGatewayRow): string {
  return gw.environment === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(gw: PaymentGatewayRow): Promise<string> {
  const clientId = requireCred(gw, "client_id");
  const clientSecret = requireCred(gw, "client_secret");
  const res = await apiFetch(`${baseUrl(gw)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok || !res.body?.access_token) {
    throw new Error(`PayPal: falha OAuth: ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token as string;
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch (s) {
    case "ACTIVE":
    case "APPROVED":
    case "COMPLETED": return "paid";
    case "CANCELLED":
    case "EXPIRED": return "canceled";
    case "SUSPENDED":
    case "FAILED": return "failed";
    case "APPROVAL_PENDING":
    case "CREATED":
    case "PENDING": return "pending";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED": return "refunded";
    default: return "unknown";
  }
}

export const paypalProvider: PaymentProvider = {
  key: "paypal",
  displayName: "PayPal",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const token = await getAccessToken(gateway);
      return {
        ok: true,
        message: `Credenciais PayPal válidas (env: ${gateway.environment})`,
        raw: { token_prefix: token.slice(0, 12) + "..." },
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao autenticar no PayPal" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "PayPal");

    const token = await getAccessToken(gateway);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // 1. Product
    const prodRes = await apiFetch(`${baseUrl(gateway)}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        ...auth,
        "PayPal-Request-Id": `prod-${plan.id}`,
      },
      body: JSON.stringify({
        name: plan.name,
        type: "SERVICE",
        category: "PERSONAL_CARE_AND_BEAUTY",
      }),
    });
    // PayPal devolve 422 se já existe com esse request-id — busca então
    let productId: string | undefined = prodRes.body?.id;
    if (!productId) {
      // best-effort: procura na listagem
      const list = await apiFetch(`${baseUrl(gateway)}/v1/catalogs/products?page_size=20`, {
        method: "GET",
        headers: auth,
      });
      productId = list.body?.products?.find((p: any) => p.name === plan.name)?.id;
    }
    if (!productId) throw new Error(`PayPal: falha criando product: ${JSON.stringify(prodRes.body)}`);

    // 2. Plan (billing)
    const planRes = await apiFetch(`${baseUrl(gateway)}/v1/billing/plans`, {
      method: "POST",
      headers: { ...auth, "PayPal-Request-Id": `plan-${plan.id}-${Date.now()}` },
      body: JSON.stringify({
        product_id: productId,
        name: plan.name,
        description: `Assinatura ${plan.name}`,
        status: "ACTIVE",
        billing_cycles: [{
          frequency: { interval_unit: "MONTH", interval_count: plan.intervalMonths ?? 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // recorrente indefinido
          pricing_scheme: {
            fixed_price: {
              value: Number(plan.amount).toFixed(2),
              currency_code: (plan.currency ?? "BRL").toUpperCase(),
            },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0", currency_code: (plan.currency ?? "BRL").toUpperCase() },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });
    if (!planRes.ok) throw new Error(`PayPal: falha criando plan: ${JSON.stringify(planRes.body)}`);
    const paypalPlanId = planRes.body.id as string;

    // 3. Subscription
    const subRes = await apiFetch(`${baseUrl(gateway)}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { ...auth, "PayPal-Request-Id": `sub-${customer.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        subscriber: {
          name: {
            given_name: (customer.name ?? "Cliente").split(" ")[0],
            surname: (customer.name ?? "Cliente").split(" ").slice(1).join(" ") || "-",
          },
          email_address: customer.email,
        },
        application_context: {
          brand_name: "Barbex",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}paypal=success`,
          cancel_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}paypal=cancel`,
        },
        custom_id: JSON.stringify({ ...(metadata ?? {}), customer_id: customer.id, plan_id: plan.id }),
      }),
    });
    if (!subRes.ok) throw new Error(`PayPal: falha criando subscription: ${JSON.stringify(subRes.body)}`);

    const links: Array<{ rel: string; href: string }> = subRes.body.links ?? [];
    const approveUrl = links.find((l) => l.rel === "approve")?.href;

    return {
      providerCustomerId: subRes.body.subscriber?.payer_id,
      providerSubscriptionId: subRes.body.id,
      checkoutUrl: approveUrl ?? returnUrl,
      status: "pending",
      raw: subRes.body,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // SEGURANÇA: validação delegada — chama endpoint verify-webhook-signature
    // do próprio PayPal com o webhook_id (armazenado em webhook_secret).
    if (!gateway.webhook_secret) {
      throw new Error("PayPal: webhook_secret (webhook_id) não configurado");
    }
    const transmissionId = hdrs["paypal-transmission-id"];
    const transmissionTime = hdrs["paypal-transmission-time"];
    const certUrl = hdrs["paypal-cert-url"];
    const authAlgo = hdrs["paypal-auth-algo"];
    const transmissionSig = hdrs["paypal-transmission-sig"];

    if (!transmissionId || !transmissionSig || !certUrl) {
      throw new Error("PayPal: cabeçalhos de assinatura ausentes");
    }

    try {
      const token = await getAccessToken(gateway);
      const verify = await apiFetch(`${baseUrl(gateway)}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: gateway.webhook_secret,
          webhook_event: p,
        }),
      });
      if (verify.body?.verification_status !== "SUCCESS") {
        throw new Error(`PayPal: assinatura inválida (${verify.body?.verification_status})`);
      }
    } catch (err: any) {
      throw new Error(`PayPal: falha verificando webhook: ${err?.message ?? err}`);
    }

    const type = String(p.event_type ?? "unknown");
    const resource = p.resource ?? {};
    const isSub = type.startsWith("BILLING.SUBSCRIPTION");
    const isPayment = type.startsWith("PAYMENT.SALE") || type.startsWith("PAYMENT.CAPTURE");

    return {
      provider: "paypal",
      eventType: type,
      providerSubscriptionId: isSub
        ? String(resource.id)
        : resource.billing_agreement_id ?? resource.supplementary_data?.related_ids?.subscription_id,
      providerPaymentId: isPayment ? String(resource.id) : undefined,
      status: mapStatus(resource.status ?? resource.state),
      amount: typeof resource.amount?.value === "string"
        ? Number(resource.amount.value)
        : typeof resource.amount?.total === "string"
          ? Number(resource.amount.total)
          : undefined,
      currency: resource.amount?.currency_code ?? resource.amount?.currency ?? "BRL",
      raw: p,
    };
  },
};
