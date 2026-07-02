import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGatewayRow,
  PaymentProvider,
  TestConnectionResult,
  WebhookEvent,
} from "../types";

const MP_BASE = "https://api.mercadopago.com";

function accessToken(gateway: PaymentGatewayRow): string {
  const token = gateway.credentials?.access_token;
  if (!token) throw new Error("Mercado Pago: access_token não configurado");
  return token;
}

async function mpFetch(path: string, gateway: PaymentGatewayRow, init: RequestInit = {}) {
  const res = await fetch(`${MP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken(gateway)}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  return { ok: res.ok, status: res.status, body: json ?? text };
}

export const mercadoPagoProvider: PaymentProvider = {
  key: "mercadopago",
  displayName: "Mercado Pago",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const token = gateway.credentials?.access_token;
      if (!token) return { ok: false, message: "Access Token ausente" };

      // Detecta modo pelo prefixo do token
      const isSandbox = token.startsWith("TEST-");
      const expectedSandbox = gateway.environment === "sandbox";
      if (expectedSandbox !== isSandbox) {
        return {
          ok: false,
          message: `Token é ${isSandbox ? "de teste (TEST-)" : "de produção (APP_USR-)"} mas o gateway está configurado como ${gateway.environment}. Ajuste o ambiente ou o token.`,
        };
      }

      // /users/me valida token e retorna dados da conta
      const res = await mpFetch("/users/me", gateway, { method: "GET" });
      if (!res.ok) {
        return {
          ok: false,
          message: `Mercado Pago rejeitou o token (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? (res.body as any).message ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      const body = res.body as any;
      return {
        ok: true,
        message: `Conectado à conta ${body.nickname ?? body.email ?? body.id}`,
        accountName: body.nickname ?? body.email ?? undefined,
        scopes: Array.isArray(body.tags) ? body.tags : undefined,
        raw: body,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar Mercado Pago" };
    }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { gateway, customer, plan, returnUrl, metadata } = input;

    const body = {
      reason: plan.name,
      auto_recurring: {
        frequency: plan.intervalMonths ?? 1,
        frequency_type: "months",
        transaction_amount: Number(plan.amount),
        currency_id: plan.currency ?? "BRL",
      },
      back_url: returnUrl,
      payer_email: customer.email,
      external_reference: customer.id,
      status: "pending",
      ...(metadata && { metadata }),
    };

    const res = await mpFetch("/preapproval", gateway, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `Mercado Pago falhou ao criar assinatura: ${
          typeof res.body === "object" && res.body ? JSON.stringify(res.body) : String(res.body)
        }`,
      );
    }
    const data = res.body as any;
    return {
      providerSubscriptionId: data.id,
      checkoutUrl: data.init_point ?? data.sandbox_init_point,
      status: "pending",
      raw: data,
    };
  },

  async parseWebhook(payload, _headers, _gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    // MP envia { type, data: { id } } ou { topic, resource }
    const eventType = p.type ?? p.topic ?? "unknown";
    const providerId = p.data?.id ?? p.resource ?? undefined;

    // Normaliza tópicos comuns
    let status: WebhookEvent["status"] = "unknown";
    if (eventType.includes("payment")) status = "pending";
    if (eventType.includes("preapproval")) status = "pending";

    return {
      provider: "mercadopago",
      eventType: String(eventType),
      providerPaymentId: String(providerId ?? ""),
      status,
      raw: p,
    };
  },
};
