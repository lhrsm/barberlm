import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS, PlanType } from "@/hooks/use-plan-limits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap, ShieldAlert, Star, Rocket, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PLAN_PRICE_IDS: Record<Exclude<PlanType, 'free'>, string> = {
  starter: "starter_monthly",
  pro: "pro_monthly",
  elite: "elite_monthly",
};

export const Route = createFileRoute("/subscription")({
  component: SubscriptionComponent,
});

function SubscriptionComponent() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, usage, limits, trialDaysRemaining, isTrial, refresh } = usePlanLimits();
  const [updating, setUpdating] = useState(false);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  const handlePlanChange = async (newPlan: PlanType) => {
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }
    if (newPlan === 'free') return;

    const priceId = PLAN_PRICE_IDS[newPlan];
    openCheckout({
      priceId,
      customerEmail: user.email,
      // userId is now handled by server context middleware
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  const handleManageSubscription = async () => {
    setUpdating(true);
    try {
      const url = await createPortalSession({
        data: {
          returnUrl: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
      });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o portal.");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!authLoading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, authLoading, role, navigate]);

  if (authLoading || !user) return null;

  const planConfigs = [
    {
      id: "starter" as PlanType,
      name: "Starter",
      price: "19,90",
      description: "Ideal para profissionais individuais.",
      icon: <Zap className="text-green-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.starter.barbers} Profissional`,
        `Serviços Ilimitados`,
        `Produtos Ilimitados`,
        `Agendamentos Ilimitados`,
        "1 Conexão WhatsApp",
      ],
      buttonText: "Assinar Starter",
      color: "green"
    },
    {
      id: "pro" as PlanType,
      name: "Pro",
      price: "39,90",
      description: "Perfeito para barbearias em crescimento.",
      icon: <Rocket className="text-purple-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.pro.barbers} Profissionais`,
        `Serviços Ilimitados`,
        `Produtos Ilimitados`,
        `Agendamentos Ilimitados`,
        "2 Conexões WhatsApp",
        "Financeiro Completo",
      ],
      buttonText: "Assinar Pro",
      color: "purple"
    },
    {
      id: "elite" as PlanType,
      name: "Elite",
      price: "59,90",
      description: "A solução definitiva sem limites.",
      icon: <Crown className="text-yellow-500 w-5 h-5" />,
      features: [
        "Profissionais Ilimitados",
        "Serviços Ilimitados",
        "Produtos Ilimitados",
        "Agendamentos Ilimitados",
        "Conexões WhatsApp Ilimitadas",
        "Suporte Prioritário",
      ],
      buttonText: "Assinar Elite",
      color: "yellow"
    }
  ];

  return (
    <AppLayout>
      <PaymentTestModeBanner />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Assinatura</h2>
            <p className="text-muted-foreground">Gerencie seu plano e limites do sistema.</p>
          </div>
          {(plan === 'starter' || plan === 'pro' || plan === 'elite') && (
            <Button variant="outline" onClick={handleManageSubscription} disabled={updating}>
              {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gerenciar Assinatura
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          {isTrial && (
            <Card className="border-blue-500/30 bg-blue-50/50">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">Seu período de teste expira em {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}</h3>
                    <p className="text-sm text-blue-700/70">Assine agora para garantir que sua barbearia não pare e continue com todos os recursos Pro!</p>
                  </div>
                </div>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 whitespace-nowrap" onClick={() => {
                  const proConfig = planConfigs.find(c => c.id === 'pro');
                  if (proConfig) handlePlanChange('pro');
                }}>
                  Assinar Plano Pro Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Plan Status */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano Atual: <span className="capitalize text-primary font-bold">{plan === 'free' ? 'Teste Grátis' : plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : 'Elite'}</span>
                  {plan === 'pro' && <Crown className="text-yellow-500 w-5 h-5" />}
                  {plan === 'elite' && <Rocket className="text-purple-500 w-5 h-5" />}
                </CardTitle>
                <CardDescription>Acompanhe o uso dos seus recursos.</CardDescription>
              </div>
              <div className="bg-background/50 px-3 py-1 rounded-full border text-xs font-medium">
                {plan === 'free' ? 'Período de Experiência' : 'Assinatura Ativa'}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profissionais</span>
                  <span className="font-bold">{usage.barbers} / {limits.barbers === Infinity ? "∞" : limits.barbers}</span>
                </div>
                <Progress value={limits.barbers === Infinity ? 100 : Math.min((usage.barbers / limits.barbers) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="font-bold">{usage.services} / {limits.services === Infinity ? "∞" : limits.services}</span>
                </div>
                <Progress value={limits.services === Infinity ? 100 : Math.min((usage.services / limits.services) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Produtos</span>
                  <span className="font-bold">{usage.products} / {limits.products === Infinity ? "∞" : limits.products}</span>
                </div>
                <Progress value={limits.products === Infinity ? 100 : Math.min((usage.products / limits.products) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agendamentos</span>
                  <span className="font-bold">{usage.monthlyAppointments} / {limits.monthlyAppointments === Infinity ? "∞" : limits.monthlyAppointments}</span>
                </div>
                <Progress value={limits.monthlyAppointments === Infinity ? 100 : Math.min((usage.monthlyAppointments / limits.monthlyAppointments) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span className="font-bold">{usage.whatsappConnections} / {limits.whatsappConnections === Infinity ? "∞" : limits.whatsappConnections}</span>
                </div>
                <Progress value={limits.whatsappConnections === Infinity ? 100 : Math.min((usage.whatsappConnections / limits.whatsappConnections) * 100, 100)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {planConfigs.map((config) => {
              const isCurrentPlan = plan === config.id;
              const isUpgrade = planConfigs.findIndex(c => c.id === plan) < planConfigs.findIndex(c => c.id === config.id);
              const isDowngrade = planConfigs.findIndex(c => c.id === plan) > planConfigs.findIndex(c => c.id === config.id);

              return (
                <Card key={config.id} className={cn(
                  "flex flex-col relative transition-all hover:shadow-md",
                  isCurrentPlan && "border-primary shadow-lg ring-1 ring-primary/20",
                  !isCurrentPlan && "opacity-90 grayscale-[0.2]"
                )}>
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Plano Atual
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-xl">{config.name}</CardTitle>
                      {config.icon}
                    </div>
                    <CardDescription className="min-h-[40px]">{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">R$ {config.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-2.5">
                      {config.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant={isCurrentPlan ? "outline" : isUpgrade ? "default" : "secondary"}
                      className={cn(
                        "w-full",
                        isUpgrade && "bg-primary hover:bg-primary/90",
                        isCurrentPlan && "border-primary/50 text-primary"
                      )} 
                      disabled={isCurrentPlan || updating}
                      onClick={() => handlePlanChange(config.id)}
                    >
                      {isCurrentPlan ? "Ativo" : isUpgrade ? `Upgrade para ${config.name}` : `Downgrade para ${config.name}`}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) closeCheckout(); }}>
        <DialogContent className="max-w-3xl min-h-[500px] max-h-[90vh] overflow-y-auto p-0 flex flex-col">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle>Finalizar assinatura</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-white">
            {checkoutElement}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}