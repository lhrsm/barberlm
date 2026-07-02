import type { PaymentProvider, ProviderKey } from "../types";
import { mercadoPagoProvider } from "./mercadopago.server";

/**
 * Stub base para providers ainda não implementados. Mantém a UI funcional
 * (permite salvar credenciais) mas rejeita testConnection com mensagem clara.
 */
function stub(key: ProviderKey, displayName: string): PaymentProvider {
  return {
    key,
    displayName,
    supportsSubscriptions: false,
    async testConnection() {
      return {
        ok: false,
        message: `Provider "${displayName}" ainda não implementado. Credenciais salvas para uso futuro.`,
      };
    },
  };
}

const REGISTRY: Record<ProviderKey, PaymentProvider> = {
  mercadopago: mercadoPagoProvider,
  asaas: stub("asaas", "Asaas"),
  stripe: stub("stripe", "Stripe"),
  pagseguro: stub("pagseguro", "PagSeguro"),
  pagarme: stub("pagarme", "Pagar.me"),
  paypal: stub("paypal", "PayPal"),
  paggue: stub("paggue", "Paggue"),
  infinitepay: stub("infinitepay", "InfinitePay"),
  custom: stub("custom", "Personalizado"),
};

export function getProvider(key: ProviderKey): PaymentProvider {
  const p = REGISTRY[key];
  if (!p) throw new Error(`Provider desconhecido: ${key}`);
  return p;
}

export function listProviders(): PaymentProvider[] {
  return Object.values(REGISTRY);
}
