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
 * PagBank/PagSeguro. Docs: https://dev.pagbank.uol.com.br/reference
 * - Auth: Bearer token
 * - Recorrência nativa exige planos pré-cadastrados (Direct Recurring) —
 *   aqui usamos /orders (cobrança única) devolvendo pay_link. A renovação
 *   mensal é responsabilidade do SaaS (cron gera novo pedido).
 * - Webhook: POST assinado com `X-Authenticity-Token` (SHA-256 do token + payload)
 *   — como o schema evolui, também aceitamos header `x-pagseguro-token`
 *   comparado direto com webhook_secret.
 */

function baseUrl(gw: PaymentGatewayRow): string {
  return gw.environment === "sandbox"
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";
}

function headers(gw: PaymentGatewayRow): Record<string, string> {
  return {
    Authorization: `Bearer ${requireCred(gw, "token")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch (s) {
    case "PAID":
    case "AUTHORIZED":
    case "COMPLETED": return "paid";
    case "IN_ANALYSIS":
    case "WAITING":
    case "PENDING": return "pending";
    case "DECLINED":
    case "CANCELED": return "canceled";
    case "REFUNDED": return "refunded";
    default: return "unknown";
  }
}

export const pagseguroProvider: PaymentProvider = {
  key: "pagseguro",
  displayName: "PagBank / PagSeguro",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const res = await apiFetch(`${baseUrl(gateway)}/public-keys`, {
        method: "POST",
        headers: headers(gateway),
        body: JSON.stringify({ type: "card" }),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `PagBank rejeitou o token (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body
              ? res.body.error_messages?.[0]?.description ?? JSON.stringify(res.body)
              : String(res.body)
          }`,
        };
      }
      return { ok: true, message: "Token PagBank válido", raw: res.body };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar PagBank" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "PagBank");

    const referenceId = `sub-${customer.id}-${Date.now()}`;
    const amountCents = Math.round(Number(plan.amount) * 100);

    // Cria pedido com item único = 1 mês. Devolve pay_link (checkout hospedado).
    const body: any = {
      reference_id: referenceId,
      customer: {
        name: customer.name || customer.email || "Cliente",
        email: customer.email,
        tax_id: customer.document?.replace(/\D+/g, ""),
        phones: customer.phone
          ? [{
              country: "55",
              area: customer.phone.slice(0, 2),
              number: customer.phone.slice(2),
              type: "MOBILE",
            }]
          : undefined,
      },
      items: [{
        name: plan.name,
        quantity: 1,
        unit_amount: amountCents,
      }],
      notification_urls: [returnUrl.replace(/\/[^/]*$/, "/api/public/subscriptions/webhook") + `?gateway=${gateway.id}`],
      payment_notification_urls: [returnUrl.replace(/\/[^/]*$/, "/api/public/subscriptions/webhook") + `?gateway=${gateway.id}`],
      metadata: { ...(metadata ?? {}), customer_id: customer.id, plan_id: plan.id },
    };

    const res = await apiFetch(`${baseUrl(gateway)}/orders`, {
      method: "POST",
      headers: headers(gateway),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`PagBank: erro criando pedido: ${JSON.stringify(res.body)}`);
    }

    const links: Array<{ rel: string; href: string }> = res.body.links ?? [];
    const payLink = links.find((l) => l.rel === "PAY" || l.rel === "pay")?.href
      ?? links.find((l) => l.rel === "SELF")?.href;

    return {
      providerSubscriptionId: res.body.id,
      checkoutUrl: payLink ?? returnUrl,
      status: "pending",
      raw: res.body,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // SEGURANÇA: aceitamos dois formatos:
    // 1) header `x-authenticity-token` = token do webhook configurado no PagBank
    // 2) header `x-pagseguro-token` batendo webhook_secret
    const auth =
      hdrs["x-authenticity-token"] ??
      hdrs["X-Authenticity-Token"] ??
      hdrs["x-pagseguro-token"] ??
      hdrs["X-PagSeguro-Token"];

    if (!gateway.webhook_secret) {
      throw new Error("PagBank: webhook_secret não configurado");
    }
    if (!auth || auth !== gateway.webhook_secret) {
      throw new Error("PagBank: token de webhook inválido");
    }

    const charge = Array.isArray(p.charges) ? p.charges[0] : p.charge;
    const status = charge?.status ?? p.status;

    return {
      provider: "pagseguro",
      eventType: String(p.event ?? "order.updated"),
      providerPaymentId: charge?.id ? String(charge.id) : undefined,
      providerSubscriptionId: p.reference_id ? String(p.reference_id) : p.id ? String(p.id) : undefined,
      status: mapStatus(status),
      amount: typeof charge?.amount?.value === "number" ? charge.amount.value / 100 : undefined,
      currency: charge?.amount?.currency ?? "BRL",
      raw: p,
    };
  },
};
