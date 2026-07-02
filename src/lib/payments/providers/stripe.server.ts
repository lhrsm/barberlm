import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGatewayRow,
  PaymentProvider,
  TestConnectionResult,
  WebhookEvent,
} from "../types";
import { apiFetch, hmacSha256Hex, requireCred, requireHttpsUrl, timingSafeEqualHex } from "./_shared";

/**
 * Stripe (BYOK — barbearia usa sua própria conta). NÃO confundir com o Stripe
 * do SaaS Barbex (esse é gerenciado via connector gateway em src/lib/stripe.server.ts).
 *
 * Aqui é modo BYOK: barbearia fornece sk_test_/sk_live_ e recebe assinaturas
 * de clientes finais diretamente na conta dela.
 *
 * - Auth: Bearer sk_...
 * - Checkout Session em modo `subscription` (hospedado pelo Stripe)
 * - Webhook: header `stripe-signature: t=...,v1=...`
 */

const BASE = "https://api.stripe.com/v1";

function headers(gw: PaymentGatewayRow): Record<string, string> {
  return {
    Authorization: `Bearer ${requireCred(gw, "secret_key")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/** Stripe usa application/x-www-form-urlencoded para POSTs. */
function form(obj: Record<string, any>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") {
          parts.push(form(item, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === "object") {
      parts.push(form(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch (s) {
    case "active":
    case "trialing":
    case "paid":
    case "succeeded": return "paid";
    case "canceled": return "canceled";
    case "past_due":
    case "unpaid":
    case "incomplete_expired":
    case "failed": return "failed";
    case "incomplete":
    case "pending": return "pending";
    default: return "unknown";
  }
}

export const stripeProvider: PaymentProvider = {
  key: "stripe",
  displayName: "Stripe",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const key = gateway.credentials?.secret_key;
      if (!key) return { ok: false, message: "Secret Key ausente" };
      const isTest = key.startsWith("sk_test_");
      const expectedTest = gateway.environment === "sandbox";
      if (expectedTest !== isTest) {
        return {
          ok: false,
          message: `Chave é ${isTest ? "de teste (sk_test_)" : "de produção (sk_live_)"} mas o gateway está configurado como ${gateway.environment}.`,
        };
      }
      const res = await apiFetch(`${BASE}/account`, { method: "GET", headers: headers(gateway) });
      if (!res.ok) {
        return {
          ok: false,
          message: `Stripe rejeitou a chave (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? res.body.error?.message ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      const b = res.body;
      return {
        ok: true,
        message: `Conectado à conta Stripe ${b.business_profile?.name ?? b.email ?? b.id}`,
        accountName: b.business_profile?.name ?? b.email,
        raw: b,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar Stripe" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "Stripe");

    // 1. Cria/recupera Customer (usa email)
    let stripeCustomerId: string | undefined;
    if (customer.email) {
      const search = await apiFetch(
        `${BASE}/customers?email=${encodeURIComponent(customer.email)}&limit=1`,
        { method: "GET", headers: headers(gateway) },
      );
      stripeCustomerId = search.body?.data?.[0]?.id;
    }
    if (!stripeCustomerId) {
      const create = await apiFetch(`${BASE}/customers`, {
        method: "POST",
        headers: headers(gateway),
        body: form({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { customer_id: customer.id },
        }),
      });
      if (!create.ok) throw new Error(`Stripe: erro criando customer: ${JSON.stringify(create.body)}`);
      stripeCustomerId = create.body.id;
    }

    // 2. Checkout Session em modo subscription com price_data inline (evita
    // precisar cadastrar Price no Stripe antes)
    const session = await apiFetch(`${BASE}/checkout/sessions`, {
      method: "POST",
      headers: headers(gateway),
      body: form({
        mode: "subscription",
        customer: stripeCustomerId,
        success_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}status=success`,
        cancel_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}status=canceled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (plan.currency ?? "brl").toLowerCase(),
              unit_amount: Math.round(Number(plan.amount) * 100),
              recurring: { interval: "month", interval_count: plan.intervalMonths ?? 1 },
              product_data: { name: plan.name },
            },
          },
        ],
        subscription_data: {
          metadata: { ...(metadata ?? {}), customer_id: customer.id, plan_id: plan.id },
        },
        metadata: { ...(metadata ?? {}), customer_id: customer.id, plan_id: plan.id },
      }),
    });
    if (!session.ok) {
      throw new Error(`Stripe: erro criando checkout session: ${JSON.stringify(session.body)}`);
    }

    return {
      providerCustomerId: stripeCustomerId,
      providerSubscriptionId: undefined, // só criada após checkout — vem via webhook
      checkoutUrl: session.body.url,
      status: "pending",
      raw: session.body,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // SEGURANÇA: header stripe-signature = "t=...,v1=..."
    const sigHeader = hdrs["stripe-signature"] ?? hdrs["Stripe-Signature"];
    if (!gateway.webhook_secret || !sigHeader) {
      throw new Error("Stripe: assinatura de webhook ausente");
    }
    let ts: string | undefined;
    const v1s: string[] = [];
    for (const part of sigHeader.split(",")) {
      const [k, v] = part.split("=", 2).map((s) => s.trim());
      if (k === "t") ts = v;
      if (k === "v1") v1s.push(v);
    }
    if (!ts || v1s.length === 0) throw new Error("Stripe: formato de assinatura inválido");
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > 300) throw new Error("Stripe: webhook antigo demais");

    const raw = JSON.stringify(p);
    const expected = await hmacSha256Hex(gateway.webhook_secret, `${ts}.${raw}`);
    const anyMatch = v1s.some((v) => timingSafeEqualHex(expected, v));
    if (!anyMatch) throw new Error("Stripe: assinatura de webhook inválida");

    const type = String(p.type ?? "unknown");
    const obj = p.data?.object ?? {};

    // Extrai subscription id / payment id conforme o evento
    let subId: string | undefined;
    let payId: string | undefined;
    let status: string | undefined = obj.status;

    if (type.startsWith("customer.subscription")) {
      subId = obj.id;
    } else if (type === "checkout.session.completed") {
      subId = obj.subscription;
      status = obj.payment_status ?? "paid";
    } else if (type.startsWith("invoice.")) {
      subId = obj.subscription;
      payId = obj.id;
      status = obj.status;
    } else if (type.startsWith("payment_intent.")) {
      payId = obj.id;
      status = obj.status;
    }

    return {
      provider: "stripe",
      eventType: type,
      providerSubscriptionId: subId,
      providerPaymentId: payId,
      status: mapStatus(status),
      amount: typeof obj.amount === "number" ? obj.amount / 100
        : typeof obj.amount_paid === "number" ? obj.amount_paid / 100
        : undefined,
      currency: obj.currency?.toUpperCase(),
      raw: p,
    };
  },
};
