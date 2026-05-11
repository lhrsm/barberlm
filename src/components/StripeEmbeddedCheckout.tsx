import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface StripeEmbeddedCheckoutProps {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({
  priceId,
  quantity,
  customerEmail,
  userId,
  returnUrl,
}: StripeEmbeddedCheckoutProps) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = async (): Promise<string> => {
    try {
      console.log("[StripeEmbeddedCheckout] 🏁 fetchClientSecret iniciado para priceId:", priceId);
      setError(null);
      
      if (!priceId) {
        console.error("[StripeEmbeddedCheckout] ❌ Price ID ausente no componente");
        throw new Error("Price ID is missing in StripeEmbeddedCheckout component.");
      }

      console.log("[StripeEmbeddedCheckout] 📡 Invocando server function: createCheckoutSession");
      const secret = await createCheckoutSession({
        data: {
          priceId,
          quantity,
          customerEmail,
          userId,
          returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      
      if (!secret) {
        console.error("[StripeEmbeddedCheckout] ❌ Erro: client_secret retornado é vazio/null");
        throw new Error("Não foi possível gerar a sessão de pagamento (secret vazio).");
      }
      
      console.log("[StripeEmbeddedCheckout] ✅ Client secret obtido com sucesso:", secret.substring(0, 10) + "...");
      return secret;
    } catch (err: any) {
      console.error("[StripeEmbeddedCheckout] 💥 CRASH em fetchClientSecret:", err);
      // Log more details about the error if it's a Response object (common in TanStack Start server functions)
      if (err instanceof Response) {
        try {
          const body = await err.text();
          console.error("[StripeEmbeddedCheckout] 🔍 Response body do erro:", body);
        } catch (e) {
          console.error("[StripeEmbeddedCheckout] 🔍 Não foi possível ler o corpo do erro");
        }
      }
      const message = err.message || "Erro desconhecido ao carregar o checkout do Stripe.";
      setError(message);
      toast.error(message);
      throw err;
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center border border-destructive/20 bg-destructive/5 rounded-lg">
        <p className="text-destructive font-medium mb-2">Ops! Algo deu errado.</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <div className="min-h-[400px] flex flex-col items-center justify-center">
          <EmbeddedCheckout />
          {/* Overlay loader while Stripe is initializing */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 pointer-events-none z-0">
             <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
          </div>
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  );
}
