import type { PaymentGatewayRow, PaymentProvider, TestConnectionResult } from "../types";
import { apiFetch, requireCred } from "./_shared";

/**
 * PagBank/PagSeguro. Docs: https://dev.pagbank.uol.com.br/reference
 * - Auth: Bearer token
 * - testConnection: GET /public-keys/card (endpoint público que valida o token)
 * - createSubscription/parseWebhook: não implementado ainda. Recurring do
 *   PagBank exige integração via Connect + planos pré-cadastrados.
 */

function baseUrl(gw: PaymentGatewayRow): string {
  return gw.environment === "sandbox"
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";
}

export const pagseguroProvider: PaymentProvider = {
  key: "pagseguro",
  displayName: "PagBank / PagSeguro",
  supportsSubscriptions: false,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const token = requireCred(gateway, "token");
      const res = await apiFetch(`${baseUrl(gateway)}/public-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ type: "card" }),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `PagBank rejeitou o token (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? res.body.error_messages?.[0]?.description ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      return { ok: true, message: "Token PagBank válido", raw: res.body };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar PagBank" };
    }
  },
};
