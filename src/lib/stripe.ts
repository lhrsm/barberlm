import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
const sandboxToken = import.meta.env.VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN;

// Detecta se estamos rodando na pré-visualização do Lovable
const isPreview = typeof window !== 'undefined' && 
  (window.location.hostname.endsWith('lovable.app') || window.location.hostname === 'localhost');

// Decidimos o ambiente: se houver um token de sandbox disponível e estivermos em preview, usamos sandbox.
// Caso contrário, seguimos o que estiver no VITE_PAYMENTS_CLIENT_TOKEN principal.
const environment: StripeEnv = (isPreview && sandboxToken) || clientToken?.startsWith('pk_test_') 
  ? 'sandbox' 
  : 'live';

const activeToken = environment === 'sandbox' ? (sandboxToken || clientToken) : clientToken;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  console.log(`[Stripe JS] getStripe() chamado. Ambiente: ${environment}`);
  if (!stripePromise) {
    if (!activeToken) {
      console.error("[Stripe JS] ❌ Nenhum token do Stripe encontrado em import.meta.env");
      return Promise.resolve(null);
    }
    console.log("[Stripe JS] 🔋 Inicializando loadStripe com token:", activeToken.substring(0, 10) + "...");
    stripePromise = loadStripe(activeToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}
