import type { PaymentGatewayRow, PaymentProvider, TestConnectionResult } from "../types";
import { requireCred } from "./_shared";

/**
 * InfinitePay (CloudWalk). Docs: https://developers.infinitepay.io/
 * A InfinitePay hoje trabalha via handle (@nickname) + link de pagamento,
 * sem API REST pública de recorrência. testConnection valida o formato
 * do handle e devolve o link canônico.
 */

export const infinitepayProvider: PaymentProvider = {
  key: "infinitepay",
  displayName: "InfinitePay",
  supportsSubscriptions: false,

  async testConnection(gateway: PaymentGatewayRow): Promise<TestConnectionResult> {
    try {
      const handle = requireCred(gateway, "handle").replace(/^@/, "").trim();
      if (!/^[a-zA-Z0-9._-]{3,40}$/.test(handle)) {
        return { ok: false, message: "Handle InfinitePay inválido (ex: sua-barbearia)" };
      }
      return {
        ok: true,
        message: `Handle @${handle} configurado. Link base: https://loja.infinitepay.io/${handle}`,
        accountName: `@${handle}`,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao validar handle InfinitePay" };
    }
  },
};
