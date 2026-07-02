import type { PaymentGatewayRow, PaymentProvider, TestConnectionResult } from "../types";
import { apiFetch, requireCred } from "./_shared";

/**
 * PayPal. Docs: https://developer.paypal.com/api/rest/
 * - Auth: OAuth2 client_credentials (client_id + secret) → access_token
 * - testConnection valida trocando as credenciais por token.
 * - Recurring (Subscriptions API) exige criar Product+Plan antes — não
 *   implementado nesta fase.
 */

function baseUrl(gw: PaymentGatewayRow): string {
  return gw.environment === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export const paypalProvider: PaymentProvider = {
  key: "paypal",
  displayName: "PayPal",
  supportsSubscriptions: false,

  async testConnection(gateway): Promise<TestConnectionResult> {
    try {
      const clientId = requireCred(gateway, "client_id");
      const clientSecret = requireCred(gateway, "client_secret");
      const basic = btoa(`${clientId}:${clientSecret}`);
      const res = await apiFetch(`${baseUrl(gateway)}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "grant_type=client_credentials",
      });
      if (!res.ok || !res.body?.access_token) {
        return {
          ok: false,
          message: `PayPal rejeitou as credenciais (HTTP ${res.status}): ${
            typeof res.body === "object" && res.body ? res.body.error_description ?? JSON.stringify(res.body) : String(res.body)
          }`,
        };
      }
      return {
        ok: true,
        message: `Credenciais PayPal válidas (scope: ${String(res.body.scope ?? "").slice(0, 80)}...)`,
        raw: { app_id: res.body.app_id, expires_in: res.body.expires_in },
      };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Falha ao contatar PayPal" };
    }
  },
};
