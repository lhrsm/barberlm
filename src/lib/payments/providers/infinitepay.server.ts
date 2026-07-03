import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGatewayRow,
  PaymentProvider,
  TestConnectionResult,
  WebhookEvent,
} from "../types";
import { hmacSha256Hex, requireCred, requireHttpsUrl, timingSafeEqualHex } from "./_shared";

/**
 * InfinitePay (CloudWalk) — checkout via URL hospedada.
 *
 * A InfinitePay não tem API REST pública de recorrência. A integração
 * é feita gerando um link no formato:
 *   https://checkout.infinitepay.io/<handle>?items=[{name,price,quantity}]&redirect_url=...
 *
 * Cada cobrança é única; renovações ficam a cargo de cron do SaaS.
 * Webhook (opcional): header `x-infinitepay-signature` = HMAC-SHA256 do body.
 */

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch ((s || "").toLowerCase()) {
    case "paid":
    case "approved":
    case "captured": return "paid";
    case "pending":
    case "processing": return "pending";
    case "refunded": return "refunded";
    case "failed":
    case "declined":
    case "canceled":
    case "cancelled": return "failed";
    default: return "unknown";
  }
}

export const infinitepayProvider: PaymentProvider = {
  key: "infinitepay",
  displayName: "InfinitePay",
  supportsSubscriptions: true, // via link mensal + cron

  async testConnection(gateway: PaymentGatewayRow): Promise<TestConnectionResult> {
    try {
      const handle = requireCred(gateway, "handle").replace(/^@/, "").replace(/^\$/, "").trim();
      if (!/^[a-zA-Z0-9._-]{3,40}$/.test(handle)) {
        return { ok: false, message: "Handle InfinitePay inválido (ex: sua-barbearia)" };
      }
      return {
        ok: true,
        message: `Handle @${handle} configurado. Checkout: https://checkout.infinitepay.io/${handle}`,
        accountName: `@${handle}`,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao validar handle InfinitePay" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "InfinitePay");

    const handle = requireCred(gateway, "handle").replace(/^@/, "").replace(/^\$/, "").trim();
    const externalId = `sub-${customer.id}-${Date.now()}`;
    const price = Number(plan.amount);

    const items = [{
      name: plan.name,
      description: `Assinatura mensal — ${plan.name}`,
      price: Math.round(price * 100), // centavos
      quantity: 1,
    }];

    const params = new URLSearchParams({
      items: JSON.stringify(items),
      redirect_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}ip_ref=${externalId}`,
      order_nsu: externalId,
      customer_name: customer.name ?? "",
      customer_email: customer.email ?? "",
      customer_cellphone: customer.phone ?? "",
    });
    if (customer.document) params.set("customer_document", customer.document.replace(/\D+/g, ""));
    if (metadata) params.set("metadata", JSON.stringify(metadata));

    const checkoutUrl = `https://checkout.infinitepay.io/${handle}?${params.toString()}`;

    return {
      providerSubscriptionId: externalId,
      checkoutUrl,
      status: "pending",
      raw: { handle, externalId, slug: slugify(plan.name) },
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // Webhook opcional — se webhook_secret configurado, valida assinatura HMAC.
    const sig = hdrs["x-infinitepay-signature"] ?? hdrs["X-InfinitePay-Signature"];
    if (gateway.webhook_secret) {
      if (!sig) throw new Error("InfinitePay: assinatura ausente");
      const expected = await hmacSha256Hex(gateway.webhook_secret, JSON.stringify(p));
      const provided = sig.startsWith("sha256=") ? sig.slice(7) : sig;
      if (!timingSafeEqualHex(expected, provided)) {
        throw new Error("InfinitePay: assinatura inválida");
      }
    }

    return {
      provider: "infinitepay",
      eventType: String(p.event ?? p.type ?? "transaction.updated"),
      providerPaymentId: p.transaction_nsu ? String(p.transaction_nsu) : p.id ? String(p.id) : undefined,
      providerSubscriptionId: p.order_nsu ? String(p.order_nsu) : undefined,
      status: mapStatus(p.status ?? p.transaction_status),
      amount: typeof p.amount === "number" ? p.amount / 100 : undefined,
      currency: "BRL",
      raw: p,
    };
  },
};
