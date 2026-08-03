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

/**
 * Verifica a assinatura HMAC-SHA256 do webhook do Mercado Pago.
 * Template oficial: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * Secret vem de gateway.webhook_secret (configurado no painel MP).
 * Retorna true se válido, false caso contrário. Se secret não estiver configurado,
 * retorna false (fail-closed) — nunca aceita webhook sem verificação.
 */
async function verifyMpSignature(
  headers: Record<string, string>,
  dataId: string,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!secret) return false;
  const sigHeader = headers["x-signature"] ?? headers["X-Signature"];
  const requestId = headers["x-request-id"] ?? headers["X-Request-Id"];
  if (!sigHeader || !requestId || !dataId) return false;

  // Parse "ts=...,v1=..."
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s.trim());
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return false;

  // Freshness (5 min)
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (await import('node:crypto')).webcrypto;
  const key = await cryptoObj.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await cryptoObj.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // timing-safe compare
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

/** Mapeia status do PAGAMENTO MP → status normalizado. */
function mapPaymentStatus(s: string | undefined): WebhookEvent["status"] {
  switch (s) {
    case "approved": return "paid";
    case "refunded":
    case "charged_back": return "refunded";
    case "rejected":
    case "cancelled": return "failed";
    case "pending":
    case "in_process":
    case "authorized": return "pending";
    default: return "unknown";
  }
}

/** Mapeia status da PREAPPROVAL (assinatura) MP → status normalizado. */
function mapPreapprovalStatus(s: string | undefined): WebhookEvent["status"] {
  switch (s) {
    case "authorized": return "paid";       // ativa → dispara "active" no handler
    case "paused":
    case "cancelled": return "canceled";
    case "pending": return "pending";
    default: return "unknown";
  }
}

export const mercadoPagoProvider: PaymentProvider = {
  key: "mercadopago",
  displayName: "Mercado Pago",
  supportsSubscriptions: true,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const token = gateway.credentials?.access_token;
      if (!token) return { ok: false, message: "Access Token ausente" };

      const isSandbox = token.startsWith("TEST-");
      const expectedSandbox = gateway.environment === "sandbox";
      if (expectedSandbox !== isSandbox) {
        return {
          ok: false,
          message: `Token é ${isSandbox ? "de teste (TEST-)" : "de produção (APP_USR-)"} mas o gateway está configurado como ${gateway.environment}. Ajuste o ambiente ou o token.`,
        };
      }

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

    // ── Validações prévias com mensagens amigáveis ──
    const token = gateway.credentials?.access_token;
    if (!token) {
      throw new Error("Mercado Pago não está configurado. Configure o Access Token em Configurações > Pagamentos.");
    }
    const isSandboxToken = token.startsWith("TEST-");
    const expectedSandbox = gateway.environment === "sandbox";
    if (isSandboxToken !== expectedSandbox) {
      throw new Error(
        `Token do Mercado Pago está em ambiente ${isSandboxToken ? "de teste" : "de produção"}, mas o gateway está configurado como ${gateway.environment}.`,
      );
    }

    if (!/^https:\/\//i.test(returnUrl)) {
      throw new Error("URL de retorno inválida. É necessário HTTPS público (não funciona em preview local).");
    }

    const email = String(customer.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("E-mail do cliente é obrigatório e deve ser válido para criar a assinatura no Mercado Pago.");
    }

    const amount = Number(plan.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Valor do plano inválido para o Mercado Pago.");
    }

    const body = {
      reason: plan.name,
      auto_recurring: {
        frequency: plan.intervalMonths ?? 1,
        frequency_type: "months",
        transaction_amount: Number(amount.toFixed(2)),
        currency_id: plan.currency ?? "BRL",
      },
      back_url: returnUrl,
      payer_email: email,
      external_reference: customer.id,
      status: "pending",
      ...(metadata && { metadata }),
    };

    console.log("[MercadoPago] Criando preapproval", {
      env: gateway.environment,
      tokenPrefix: token.slice(0, 8),
      plan: plan.name,
      amount: body.auto_recurring.transaction_amount,
      payer_email: email,
      back_url: returnUrl,
    });

    const res = await mpFetch("/preapproval", gateway, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[MercadoPago] preapproval error", {
        status: res.status,
        body: res.body,
        payload: body,
      });
      const mpBody: any = res.body;
      const mpMessage =
        (typeof mpBody === "object" && mpBody && (mpBody.message ?? mpBody.error)) ||
        (typeof mpBody === "string" ? mpBody : `HTTP ${res.status}`);
      const cause =
        typeof mpBody === "object" && Array.isArray(mpBody?.cause) && mpBody.cause.length
          ? ` (${mpBody.cause.map((c: any) => c.description ?? c.code).join("; ")})`
          : "";

      // Traduz erros comuns do MP
      let friendly = String(mpMessage);
      if (res.status === 401 || /invalid.*token|unauthoriz/i.test(friendly)) {
        friendly = "Token do Mercado Pago inválido ou expirado. Reconecte o gateway em Configurações > Pagamentos.";
      } else if (res.status === 400 && /payer_email/i.test(friendly + cause)) {
        friendly = "E-mail do cliente inválido para o Mercado Pago. Verifique o cadastro do cliente.";
      } else if (res.status === 400 && /back_url/i.test(friendly + cause)) {
        friendly = "URL de retorno inválida no Mercado Pago. Use HTTPS público.";
      } else if (res.status === 500) {
        friendly = `Mercado Pago retornou erro interno. ${friendly}${cause}. Verifique se a conta pode criar assinaturas e se o e-mail do pagador é diferente do e-mail da conta vendedora.`;
      }

      throw new Error(friendly);
    }
    const data = res.body as any;
    return {
      providerSubscriptionId: data.id,
      checkoutUrl: data.init_point ?? data.sandbox_init_point,
      status: "pending",
      raw: data,
    };
  },


  async parseWebhook(payload, headers, gateway): Promise<WebhookEvent | null> {
    const p = payload as any;
    if (!p) return null;

    const eventType: string = String(p.type ?? p.topic ?? "unknown");
    const dataId: string = String(p.data?.id ?? p.resource ?? "");
    if (!dataId) return null;

    // ── SEGURANÇA: verifica assinatura HMAC antes de aceitar qualquer coisa ──
    const valid = await verifyMpSignature(headers, dataId, gateway.webhook_secret);
    if (!valid) {
      throw new Error("Assinatura do webhook Mercado Pago inválida ou ausente");
    }

    // Busca o recurso real no MP pra saber o status verdadeiro
    if (eventType.includes("payment")) {
      const res = await mpFetch(`/v1/payments/${dataId}`, gateway, { method: "GET" });
      if (!res.ok) return null;
      const pay = res.body as any;
      // preapproval_id conecta o pagamento à assinatura recorrente
      const preapprovalId: string | undefined = pay.metadata?.preapproval_id ?? pay.preapproval_id ?? undefined;
      return {
        provider: "mercadopago",
        eventType,
        providerPaymentId: String(pay.id),
        providerSubscriptionId: preapprovalId ? String(preapprovalId) : undefined,
        status: mapPaymentStatus(pay.status),
        amount: typeof pay.transaction_amount === "number" ? pay.transaction_amount : undefined,
        currency: pay.currency_id,
        raw: pay,
      };
    }

    if (eventType.includes("preapproval") || eventType.includes("subscription")) {
      const res = await mpFetch(`/preapproval/${dataId}`, gateway, { method: "GET" });
      if (!res.ok) return null;
      const pre = res.body as any;
      return {
        provider: "mercadopago",
        eventType,
        providerSubscriptionId: String(pre.id),
        status: mapPreapprovalStatus(pre.status),
        amount: typeof pre.auto_recurring?.transaction_amount === "number"
          ? pre.auto_recurring.transaction_amount : undefined,
        currency: pre.auto_recurring?.currency_id,
        raw: pre,
      };
    }

    return {
      provider: "mercadopago",
      eventType,
      status: "unknown",
      raw: p,
    };
  },
};
