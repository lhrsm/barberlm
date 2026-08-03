import type { PaymentProvider, ProviderKey } from "../types";

/**
 * Registry dinâmico para evitar imports estáticos de providers no build do cliente.
 */
export async function getProvider(key: ProviderKey): Promise<PaymentProvider> {
  switch (key) {
    case "mercadopago":
      return (await import("./mercadopago.server")).mercadoPagoProvider;
    case "asaas":
      return (await import("./asaas.server")).asaasProvider;
    case "stripe":
      return (await import("./stripe.server")).stripeProvider;
    case "pagseguro":
      return (await import("./pagseguro.server")).pagseguroProvider;
    case "pagarme":
      return (await import("./pagarme.server")).pagarmeProvider;
    case "paypal":
      return (await import("./paypal.server")).paypalProvider;
    case "paggue":
      return (await import("./paggue.server")).paggueProvider;
    case "infinitepay":
      return (await import("./infinitepay.server")).infinitepayProvider;
    case "custom":
      return {
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
    default:
      throw new Error(`Provider desconhecido: ${key}`);
  }
}

export async function listProviders(): Promise<PaymentProvider[]> {
  const keys: ProviderKey[] = [
    "mercadopago",
    "asaas",
    "stripe",
    "pagseguro",
    "pagarme",
    "paypal",
    "paggue",
    "infinitepay",
    "custom",
  ];
  return Promise.all(keys.map(getProvider));
}
