import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {sessionId ? (
            <>
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
              <p className="text-muted-foreground">
                Sua assinatura está sendo ativada. Você já pode acessar todos os recursos do seu plano.
              </p>
              <Button asChild className="w-full">
                <Link to="/dashboard">Ir para o painel</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Sem informações de pagamento</h1>
              <p className="text-muted-foreground">Não foi possível identificar a sessão.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/subscription">Voltar para assinaturas</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
