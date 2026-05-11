import { getStripeEnvironment } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  const environment = getStripeEnvironment();
  
  if (environment !== 'sandbox') return null;

  return (
    <div className="w-full bg-blue-100 border-b border-blue-300 px-4 py-3 text-center text-sm text-blue-800 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        <p>
          <strong>Modo de Teste Ativo:</strong> Use cartões de teste da Stripe para validar o fluxo.{" "}
          <a
            href="https://docs.lovable.dev/features/payments#test-and-live-environments"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold hover:text-blue-600 transition-colors"
          >
            Saiba mais
          </a>
        </p>
      </div>
    </div>
  );
}
