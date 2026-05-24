import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
const sandboxToken = import.meta.env.VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN;

// Detecta se estamos rodando na pré-visualização do Lovable
const isPreview = typeof window !== 'undefined' && 
  (window.location.hostname.endsWith('lovable.app') || window.location.hostname === 'localhost');

let currentEnvironment: StripeEnv = 'sandbox';

// Função para inicializar o ambiente buscando do banco de dados (opcional, para redundância)
// Mas por padrão usaremos a lógica de detecção automática + override via props se necessário
export function getStripeEnvironment(): StripeEnv {
  // Se houver um token de sandbox disponível e estivermos em preview, forçamos sandbox.
  if (isPreview && sandboxToken) return 'sandbox';
  
  // Caso contrário, verificamos o token principal
  if (clientToken?.startsWith('pk_test_')) return 'sandbox';
  
  return 'live';
}

const activeToken = getStripeEnvironment() === 'sandbox' ? (sandboxToken || clientToken) : clientToken;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  const env = getStripeEnvironment();
  console.log(`[Stripe JS] getStripe() chamado. Ambiente: ${env}`);
  if (!stripePromise) {
    if (!activeToken) {
      console.error("[Stripe JS] ❌ Nenhum token do Stripe encontrado em import.meta.env");
      return Promise.resolve(null);
    }
    console.log("[Stripe JS] 🔋 Inicializando loadStripe with token:", activeToken.substring(0, 10) + "...");
    stripePromise = loadStripe(activeToken);
  }
  return stripePromise;
}
