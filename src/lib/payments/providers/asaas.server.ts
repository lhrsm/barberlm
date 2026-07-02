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
 * Asaas — gateway BR popular. Docs: https://docs.asaas.com/
 * - Auth: header `access_token: $aact_...`
 * - Sandbox: https://sandbox.asaas.com/api/v3
 * - Prod:    https://api.asaas.com/v3
 * - Webhook: header `asaas-access-token` deve bater com o valor configurado
 *   no painel Asaas (armazenamos em gateway.webhook_secret).
 */

function baseUrl(gw: PaymentGatewayRow): string {
  return gw.environment === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

function headers(gw: PaymentGatewayRow): Record<string, string> {
  return {
    access_token: requireCred(gw, "api_key"),
    "Content-Type": "application/json",
    "User-Agent": "Barbex/1.0",
  };
}

function mapStatus(s?: string): WebhookEvent["status"] {
  switch (s) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH": return "paid";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "PARTIALLY_REFUNDED": return "refunded";
    case "OVERDUE":
    case "PAYMENT_DELETED":
    case "PAYMENT_ERROR": return "failed";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS": return "pending";
    default: return "unknown";
  }
}

export const asaasProvider: PaymentProvider = {
  key: "asaas",
  displayName: "Asaas",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const res = await apiFetch(`${baseUrl(gateway)}/myAccount`, {
        method: "GET",
        headers: headers(gateway),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `Asaas rejeitou a chave (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? res.body.errors?.[0]?.description ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      const b = res.body;
      return {
        ok: true,
        message: `Conectado à conta Asaas ${b.name ?? b.email ?? b.id ?? ""}`.trim(),
        accountName: b.name ?? b.email,
        raw: b,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar Asaas" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;
    requireHttpsUrl(returnUrl, "Asaas");

    if (!customer.email) throw new Error("Asaas exige e-mail do cliente");

    // 1. Cria/recupera customer no Asaas
    const custRes = await apiFetch(`${baseUrl(gateway)}/customers`, {
      method: "POST",
      headers: headers(gateway),
      body: JSON.stringify({
        name: customer.name || customer.email,
        email: customer.email,
        mobilePhone: customer.phone,
        cpfCnpj: customer.document,
        externalReference: customer.id,
        notificationDisabled: false,
      }),
    });
    if (!custRes.ok) {
      throw new Error(`Asaas: erro criando cliente: ${JSON.stringify(custRes.body)}`);
    }
    const asaasCustomerId = custRes.body.id as string;

    // 2. Cria assinatura recorrente (cobrança mensal via BOLETO ou UNDEFINED = deixa cliente escolher)
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1); // próxima cobrança amanhã
    const subRes = await apiFetch(`${baseUrl(gateway)}/subscriptions`, {
      method: "POST",
      headers: headers(gateway),
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED", // cliente escolhe boleto/pix/cartão
        value: Number(plan.amount),
        nextDueDate: nextDue.toISOString().slice(0, 10),
        cycle: (plan.intervalMonths ?? 1) === 1 ? "MONTHLY" : "YEARLY",
        description: plan.name,
        externalReference: customer.id,
        ...(metadata && { metadata }),
      }),
    });
    if (!subRes.ok) {
      throw new Error(`Asaas: erro criando assinatura: ${JSON.stringify(subRes.body)}`);
    }
    const sub = subRes.body;

    // Asaas não devolve URL de checkout hospedado; a cobrança inicial vem
    // por e-mail. Buscamos a 1ª cobrança pra pegar o invoiceUrl.
    let invoiceUrl: string | undefined;
    try {
      const paysRes = await apiFetch(
        `${baseUrl(gateway)}/subscriptions/${sub.id}/payments?limit=1`,
        { method: "GET", headers: headers(gateway) },
      );
      invoiceUrl = paysRes.body?.data?.[0]?.invoiceUrl;
    } catch { /* ignore */ }

    return {
      providerCustomerId: asaasCustomerId,
      providerSubscriptionId: sub.id,
      checkoutUrl: invoiceUrl ?? returnUrl,
      status: "pending",
      raw: sub,
    };
  },

  async parseWebhook(payload, hdrs, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // SEGURANÇA: Asaas envia header `asaas-access-token` — deve bater com token configurado
    const token = hdrs["asaas-access-token"] ?? hdrs["Asaas-Access-Token"];
    if (!gateway.webhook_secret || token !== gateway.webhook_secret) {
      throw new Error("Asaas: webhook token inválido ou ausente");
    }

    const pay = p.payment;
    if (!pay) {
      return { provider: "asaas", eventType: String(p.event ?? "unknown"), status: "unknown", raw: p };
    }

    return {
      provider: "asaas",
      eventType: String(p.event ?? "unknown"),
      providerPaymentId: String(pay.id),
      providerSubscriptionId: pay.subscription ? String(pay.subscription) : undefined,
      status: mapStatus(pay.status),
      amount: typeof pay.value === "number" ? pay.value : undefined,
      currency: "BRL",
      raw: p,
    };
  },
};
