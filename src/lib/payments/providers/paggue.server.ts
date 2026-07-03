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
 * Paggue (Pix). Docs: https://docs.paggue.io/
 *
 * A Paggue não expõe recorrência nativa — geramos uma cobrança Pix única
 * do 1º mês e devolvemos a URL do checkout hospedado (page.paggue.io).
 * Renovações mensais são responsabilidade do SaaS (cron externo dispara
 * novo `createSubscription` a cada ciclo).
 *
 * Webhook: header `x-paggue-signature` = HMAC-SHA256(body_raw, webhook_secret).
 */

const BASE = "https://ms.paggue.io";

function authHeaders(gw: PaymentGatewayRow): Record<string, string> {
  return {
    Authorization: `Bearer ${requireCred(gw, "api_key")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch ((s || "").toUpperCase()) {
    case "PAID":
    case "COMPLETED":
    case "APPROVED": return "paid";
    case "PENDING":
    case "WAITING":
    case "PROCESSING": return "pending";
    case "REFUNDED": return "refunded";
    case "CANCELED":
    case "CANCELLED":
    case "EXPIRED":
    case "FAILED": return "failed";
    default: return "unknown";
  }
}

export const paggueProvider: PaymentProvider = {
  key: "paggue",
  displayName: "Paggue",
  supportsSubscriptions: true, // via Pix mensal recorrente pelo cron

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const res = await apiFetch(`${BASE}/cashout-transactions?limit=1`, {
        method: "GET",
        headers: authHeaders(gateway),
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "Paggue rejeitou o token (401/403)" };
      }
      if (!res.ok && res.status !== 404) {
        return {
          ok: false,
          message: `Paggue devolveu HTTP ${res.status}: ${
            typeof res.body === "object" && res.body ? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      return { ok: true, message: "Token Paggue aceito", raw: res.body };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar Paggue" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "Paggue");

    const externalId = `sub-${customer.id}-${Date.now()}`;
    const amountCents = Math.round(Number(plan.amount) * 100);

    // Cria cobrança Pix — endpoint /cash-in devolve pix_code + checkout_url
    const res = await apiFetch(`${BASE}/cash-in`, {
      method: "POST",
      headers: authHeaders(gateway),
      body: JSON.stringify({
        external_id: externalId,
        amount: amountCents,
        payer: {
          name: customer.name || customer.email || "Cliente",
          document: customer.document?.replace(/\D+/g, ""),
          email: customer.email,
        },
        description: plan.name,
        expiration: 3600, // 1h para pagar
        callback_url:
          returnUrl.replace(/\/[^/]*$/, "/api/public/subscriptions/webhook") +
          `?gateway=${gateway.id}`,
        return_url: returnUrl,
        metadata: { ...(metadata ?? {}), customer_id: customer.id, plan_id: plan.id },
      }),
    });
    if (!res.ok) {
      throw new Error(`Paggue: erro criando cobrança: ${JSON.stringify(res.body)}`);
    }
    const b = res.body ?? {};

    return {
      providerSubscriptionId: b.id ? String(b.id) : externalId,
      checkoutUrl: b.checkout_url ?? b.payment_url ?? returnUrl,
      status: "pending",
      raw: b,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    const sig = hdrs["x-paggue-signature"] ?? hdrs["X-Paggue-Signature"];
    if (!gateway.webhook_secret) throw new Error("Paggue: webhook_secret não configurado");
    if (!sig) throw new Error("Paggue: assinatura ausente");

    const raw = JSON.stringify(p);
    const expected = await hmacSha256Hex(gateway.webhook_secret, raw);
    const provided = sig.startsWith("sha256=") ? sig.slice(7) : sig;
    if (!timingSafeEqualHex(expected, provided)) {
      throw new Error("Paggue: assinatura de webhook inválida");
    }

    return {
      provider: "paggue",
      eventType: String(p.event ?? p.type ?? "cash_in.updated"),
      providerPaymentId: p.id ? String(p.id) : undefined,
      providerSubscriptionId: p.external_id ? String(p.external_id) : undefined,
      status: mapStatus(p.status),
      amount: typeof p.amount === "number" ? p.amount / 100 : undefined,
      currency: "BRL",
      raw: p,
    };
  },
};
