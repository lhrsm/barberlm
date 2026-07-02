import type { PaymentGatewayRow, PaymentProvider, TestConnectionResult } from "../types";
import { apiFetch, requireCred } from "./_shared";

/**
 * Paggue (Pix). Docs: https://docs.paggue.io/
 * - Auth: Bearer token
 * - Foco em Pix (cash-in), sem recorrência nativa — subscriptions ficam a
 *   cargo de agendamento no lado do SaaS.
 */

const BASE = "https://ms.paggue.io";

export const paggueProvider: PaymentProvider = {
  key: "paggue",
  displayName: "Paggue",
  supportsSubscriptions: false,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const token = requireCred(gateway, "api_key");
      // /auth valida token; se falhar tenta /cashout-transactions (endpoint listado)
      const res = await apiFetch(`${BASE}/cashout-transactions?limit=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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
};
