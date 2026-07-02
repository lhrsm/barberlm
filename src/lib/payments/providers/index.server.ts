import type { PaymentProvider, ProviderKey } from "../types";
import { mercadoPagoProvider } from "./mercadopago.server";
import { asaasProvider } from "./asaas.server";
import { pagarmeProvider } from "./pagarme.server";
import { stripeProvider } from "./stripe.server";
import { pagseguroProvider } from "./pagseguro.server";
import { paypalProvider } from "./paypal.server";
import { paggueProvider } from "./paggue.server";
import { infinitepayProvider } from "./infinitepay.server";

/**
 * Stub para providers marcados como "custom" — barbearia usa webhook próprio
 * ou fluxo manual. Só valida presença de credencial genérica.
 */
const customProvider: PaymentProvider = {
  key: "custom",
  displayName: "Personalizado",
  supportsSubscriptions: false,
  async testConnection() {
    return {
      ok: true,
      message: "Gateway personalizado — credenciais armazenadas. Integre via webhook manual.",
    };
  },
};

const REGISTRY: Record<ProviderKey, PaymentProvider> = {
  mercadopago: mercadoPagoProvider,
  asaas: asaasProvider,
  stripe: stripeProvider,
  pagseguro: pagseguroProvider,
  pagarme: pagarmeProvider,
  paypal: paypalProvider,
  paggue: paggueProvider,
  infinitepay: infinitepayProvider,
  custom: customProvider,
};

export function getProvider(key: ProviderKey): PaymentProvider {
  const p = REGISTRY[key];
  if (!p) throw new Error(`Provider desconhecido: ${key}`);
  return p;
}

export function listProviders(): PaymentProvider[] {
  return Object.values(REGISTRY);
}
