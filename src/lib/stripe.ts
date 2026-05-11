import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
const environment: StripeEnv = clientToken?.startsWith('pk_test_') ? 'sandbox' : 'live';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  console.log("[Stripe JS] getStripe() chamado");
  if (!stripePromise) {
    if (!clientToken) {
      console.error("[Stripe JS] ❌ VITE_PAYMENTS_CLIENT_TOKEN não encontrado em import.meta.env");
      // Ao invés de throw, retornamos uma promise que resolve para null para evitar crash no render
      return Promise.resolve(null);
    }
    console.log("[Stripe JS] 🔋 Inicializando loadStripe com token:", clientToken.substring(0, 10) + "...");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}
