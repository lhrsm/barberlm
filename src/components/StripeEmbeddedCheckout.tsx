import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

      // Obtendo o token de acesso do Supabase para autenticar a chamada do servidor
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error("[StripeEmbeddedCheckout] ❌ Token de acesso não encontrado");
        throw new Error("Você precisa estar autenticado para realizar esta operação.");
      }

      console.log("[StripeEmbeddedCheckout] 📡 Invocando server function com token");
      
      const sessionPromise = createCheckoutSession({
        data: {
          priceId,
          quantity,
          customerEmail,
          userId,
          returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("A requisição ao servidor expirou (timeout de 60s).")), 60000)
      );

      const secret = await Promise.race([sessionPromise, timeoutPromise]) as string;
      
      if (!secret) {
        console.error("[StripeEmbeddedCheckout] ❌ Erro: client_secret retornado é vazio/null");
        throw new Error("Não foi possível gerar a sessão de pagamento (secret vazio).");
      }
      
      console.log("[StripeEmbeddedCheckout] ✅ Client secret obtido com sucesso");
      return secret;
    } catch (err: any) {
      console.error("[StripeEmbeddedCheckout] 💥 Erro em fetchClientSecret:", err);
      
      let message = "Erro ao carregar o checkout do Stripe.";
      
      if (err instanceof Response) {
        try {
          const body = await err.text();
          console.error("[StripeEmbeddedCheckout] 🔍 Erro do Servidor (Body):", body);
          message = body || `Erro do Servidor (${err.status})`;
        } catch (e) {
          message = `Erro do Servidor (${err.status})`;
        }
      } else if (err.message) {
        message = err.message;
      }
      
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
        <div className="min-h-[400px] flex flex-col items-center justify-center relative">
          <EmbeddedCheckout />
          {/* Stripe EmbeddedCheckout gerencia seu próprio carregamento */}

        </div>
      </EmbeddedCheckoutProvider>
    </div>
  );
}
