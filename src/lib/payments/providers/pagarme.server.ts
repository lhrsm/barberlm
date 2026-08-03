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
 * Pagar.me (Core API v5). Docs: https://docs.pagar.me/reference
 * - Auth: HTTP Basic com secret_key (sk_...) como usuário e senha vazia.
 * - Base: https://api.pagar.me/core/v5
 * - Webhook: header `X-Hub-Signature` = "sha256=<hex>" (HMAC do body cru).
 */

const BASE = "https://api.pagar.me/core/v5";

function authHeader(gw: PaymentGatewayRow): string {
  const key = requireCred(gw, "secret_key");
  // btoa no Worker pode falhar dependendo do runtime; usando Buffer se disponível ou fallback seguro
  const creds = `${key}:`;
  const base64 = typeof btoa === 'function' 
    ? btoa(creds) 
    : Buffer.from(creds).toString('base64');
  return `Basic ${base64}`;
}

function headers(gw: PaymentGatewayRow): Record<string, string> {
  return {
    Authorization: authHeader(gw),
    "Content-Type": "application/json",
  };
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch (s) {
    case "paid":
    case "active":
    case "authorized": return "paid";
    case "refunded":
    case "chargedback": return "refunded";
    case "failed":
    case "not_authorized":
    case "with_error": return "failed";
    case "pending":
    case "processing":
    case "waiting_payment": return "pending";
    case "canceled":
    case "cancelled": return "canceled";
    default: return "unknown";
  }
}

export const pagarmeProvider: PaymentProvider = {
  key: "pagarme",
  displayName: "Pagar.me",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      // Pagar.me não tem /me; usamos /plans?size=1 que responde com a merchant vinculada
      const res = await apiFetch(`${BASE}/plans?size=1`, { method: "GET", headers: headers(gateway) });
      if (!res.ok) {
        return {
          ok: false,
          message: `Pagar.me rejeitou a chave (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? res.body.message ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      return {
        ok: true,
        message: "Chave Pagar.me válida",
        raw: res.body,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar Pagar.me" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "Pagar.me");
    if (!customer.email) throw new Error("Pagar.me exige e-mail do cliente");

    // Cria assinatura direto (sem plano pré-cadastrado — usa pricing_scheme unit)
    const body = {
      code: `sub-${customer.id}-${Date.now()}`,
      payment_method: "credit_card",
      interval: "month",
      interval_count: plan.intervalMonths ?? 1,
      billing_type: "prepaid",
      currency: plan.currency ?? "BRL",
      customer: {
        name: customer.name || customer.email,
        email: customer.email,
        code: customer.id,
        document: customer.document,
        type: "individual",
        phones: customer.phone
          ? {
              mobile_phone: {
                country_code: "55",
                area_code: customer.phone.slice(0, 2),
                number: customer.phone.slice(2),
              },
            }
          : undefined,
      },
      items: [
        {
          description: plan.name,
          quantity: 1,
          pricing_scheme: {
            scheme_type: "unit",
            price: Math.round(Number(plan.amount) * 100), // centavos
          },
        },
      ],
      metadata: { ...(metadata ?? {}), return_url: returnUrl },
    };

    const res = await apiFetch(`${BASE}/subscriptions`, {
      method: "POST",
      headers: headers(gateway),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Pagar.me: erro criando assinatura: ${JSON.stringify(res.body)}`);
    }
    const sub = res.body;

    // Pagar.me v5 não hospeda checkout — barbearia normalmente usa integração
    // via SDK Client-side pra tokenizar cartão. Aqui devolvemos returnUrl e
    // sinalizamos que o fluxo precisa ser finalizado pela UI da barbearia.
    return {
      providerCustomerId: sub.customer?.id,
      providerSubscriptionId: sub.id,
      checkoutUrl: returnUrl,
      status: "pending",
      raw: sub,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // SEGURANÇA: header X-Hub-Signature = "sha256=<hex>"
    const sigHeader = hdrs["x-hub-signature"] ?? hdrs["X-Hub-Signature"];
    if (!gateway.webhook_secret || !sigHeader) {
      throw new Error("Pagar.me: assinatura de webhook ausente");
    }
    const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice(7) : sigHeader;
    // Precisamos do body cru — payload já veio parseado. Reconstruimos JSON
    // canônico (aceitável em prática pois Pagar.me serializa sem espaços).
    const raw = JSON.stringify(p);
    const expected = await hmacSha256Hex(gateway.webhook_secret, raw);
    if (!timingSafeEqualHex(expected, provided)) {
      throw new Error("Pagar.me: assinatura de webhook inválida");
    }

    const type = String(p.type ?? "unknown");
    const data = p.data ?? {};
    const isSub = type.startsWith("subscription");
    const isCharge = type.startsWith("charge") || type.startsWith("order");

    return {
      provider: "pagarme",
      eventType: type,
      providerSubscriptionId: isSub ? String(data.id) : data.subscription_id ? String(data.subscription_id) : undefined,
      providerPaymentId: isCharge ? String(data.id) : undefined,
      status: mapStatus(data.status),
      amount: typeof data.amount === "number" ? data.amount / 100 : undefined,
      currency: data.currency ?? "BRL",
      raw: p,
    };
  },
};
