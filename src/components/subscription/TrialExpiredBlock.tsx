import { ShieldAlert, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function TrialExpiredBlock() {
  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 overflow-auto">
      <Card className="max-w-md w-full border-2 border-primary/20 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-primary animate-bounce" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black tracking-tight">Período de Teste Terminou</CardTitle>
            <CardDescription className="text-lg">
              Seu período de 15 dias de teste grátis no BarberLM expirou. Escolha um plano para continuar utilizando nossa plataforma.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-accent/50 p-6 rounded-2xl border border-white/5 space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-ping" />
              Por que assinar?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">✓ Gestão completa de agenda e clientes</li>
              <li className="flex items-center gap-2">✓ Automações de WhatsApp ilimitadas</li>
              <li className="flex items-center gap-2">✓ Controle financeiro e de comissões</li>
              <li className="flex items-center gap-2">✓ Dashboard profissional de métricas</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" size="lg">
            <Link to="/subscription">
              <CreditCard className="mr-2 h-5 w-5" />
              Escolher um Plano agora
            </Link>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Seus dados estão seguros e serão restaurados após a assinatura.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
