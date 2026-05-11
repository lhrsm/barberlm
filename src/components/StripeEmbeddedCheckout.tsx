import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";
import { Loader2 } from "lucide-react";
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
      setError(null);
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
      
      if (!secret) throw new Error("Não foi possível gerar a sessão de pagamento.");
      return secret;
    } catch (err: any) {
      console.error("Checkout error:", err);
      const message = err.message || "Erro ao carregar o checkout do Stripe.";
      setError(message);
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
