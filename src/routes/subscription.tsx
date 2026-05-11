import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS, PlanType } from "@/hooks/use-plan-limits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap, ShieldAlert, Star, Rocket, Clock, Loader2, AlertCircle, AlertTriangle, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
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
  starter: "price_1TVtOWPKG6q10UjrQErPgyKO",
  pro: "price_1TVtOVPKG6q10Ujre6zMGYpk",
  elite: "price_1TVsefPKG6q10UjrKpTaUe71",
};

export const Route = createFileRoute("/subscription")({
  component: SubscriptionComponent,
});

function SubscriptionComponent() {
  console.log("[Subscription] Rendering SubscriptionComponent");
  let auth, planLimits, checkout;
  
  try {
    auth = useAuth();
    planLimits = usePlanLimits();
    checkout = useStripeCheckout();
    console.log("[Subscription] Hooks loaded:", { 
      authLoading: auth.loading, 
      planLoading: planLimits.loading, 
      plan: planLimits.plan 
    });
  } catch (err) {
    console.error("[Subscription] Error loading hooks:", err);
    throw err;
  }

  const { user, loading: authLoading, role } = auth;
  const { plan, usage, limits, trialDaysRemaining, isTrial, loading: planLoading, subscription } = planLimits;
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = checkout;

  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);

  const handlePlanChange = async (newPlan: PlanType) => {
    // ... same code
    console.log("[Subscription] handlePlanChange:", newPlan);
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }
    if (newPlan === 'free') return;

    const priceId = PLAN_PRICE_IDS[newPlan];
    if (!priceId) {
      toast.error("Erro interno: ID do preço não configurado.");
      return;
    }
    
    try {
      openCheckout({
        priceId,
        customerEmail: user.email,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (err) {
      console.error("[Subscription] openCheckout error:", err);
      toast.error("Erro ao iniciar o checkout.");
    }
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
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e: any) {
      console.error("[Subscription] manageSubscription error:", e);
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

  if (authLoading || planLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    console.log("[Subscription] No user found after loading");
    return null;
  }

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
          {plan !== 'free' && (
            <Button variant="outline" onClick={handleManageSubscription} disabled={updating}>
              {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gerenciar Assinatura
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          {/* Status Alerts */}
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
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 whitespace-nowrap" onClick={() => handlePlanChange('pro')}>
                  Assinar Plano Pro Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {subscription?.status === 'past_due' && (
            <Card className="border-yellow-500/30 bg-yellow-50/50">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900">Pagamento Pendente</h3>
                    <p className="text-sm text-yellow-700/70">Houve um problema com a sua última cobrança. Atualize sua forma de pagamento para evitar a suspensão dos recursos premium.</p>
                  </div>
                </div>
                <Button variant="outline" className="border-yellow-500 text-yellow-700 hover:bg-yellow-100" onClick={handleManageSubscription}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Atualizar Cartão
                </Button>
              </CardContent>
            </Card>
          )}

          {subscription?.status === 'unpaid' && (
            <Card className="border-red-500/30 bg-red-50/50">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-full text-red-600">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-900">Assinatura Suspensa</h3>
                    <p className="text-sm text-red-700/70">Sua assinatura está inativa devido a falhas recorrentes no pagamento. Seus recursos premium foram temporariamente bloqueados.</p>
                  </div>
                </div>
                <Button className="bg-red-600 hover:bg-red-700" onClick={handleManageSubscription}>
                  Regularizar Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {subscription?.status === 'canceled' && (
            <Card className="border-gray-500/30 bg-gray-50/50">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-full text-gray-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Assinatura Cancelada</h3>
                    <p className="text-sm text-gray-700/70">Sua assinatura anterior foi cancelada. Escolha um novo plano abaixo para continuar aproveitando os benefícios.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {subscription?.status === 'incomplete' && (
            <Card className="border-blue-500/30 bg-blue-50/50">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">Checkout Pendente</h3>
                    <p className="text-sm text-blue-700/70">Você tem uma assinatura que ainda não foi concluída. Por favor, finalize o pagamento.</p>
                  </div>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleManageSubscription}>
                  Finalizar Pagamento
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Plan Status */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano Atual: <span className="capitalize text-primary font-bold">{
                    plan === 'starter' ? 'Starter' : 
                    plan === 'pro' ? 'Pro' : 
                    plan === 'elite' ? 'Elite' : 
                    (!plan || plan === 'free') ? 'Grátis' : 
                    plan
                  }</span>
                  {plan === 'pro' && <Crown className="text-yellow-500 w-5 h-5" />}
                  {plan === 'elite' && <Rocket className="text-purple-500 w-5 h-5" />}
                </CardTitle>
                <CardDescription>Acompanhe o uso dos seus recursos.</CardDescription>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full border text-xs font-medium",
                subscription?.status === 'active' ? "bg-green-100 text-green-700 border-green-200" :
                subscription?.status === 'trialing' ? "bg-blue-100 text-blue-700 border-blue-200" :
                subscription?.status === 'past_due' ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                subscription?.status === 'unpaid' ? "bg-red-100 text-red-700 border-red-200" :
                "bg-background/50"
              )}>
                {subscription?.status === 'active' ? 'Assinatura Ativa' :
                 subscription?.status === 'trialing' ? 'Período de Teste' :
                 subscription?.status === 'past_due' ? 'Pagamento Pendente' :
                 subscription?.status === 'unpaid' ? 'Inadimplente' :
                 subscription?.status === 'canceled' ? 'Cancelada' :
                 plan === 'free' ? 'Plano Gratuito' : 'Assinatura Ativa'}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profissionais</span>
                  <span className="font-bold">{usage?.barbers ?? 0} / {limits?.barbers === Infinity ? "∞" : (limits?.barbers ?? 0)}</span>
                </div>
                <Progress value={limits?.barbers === Infinity ? 100 : Math.min(((usage?.barbers || 0) / (limits?.barbers || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="font-bold">{usage?.services ?? 0} / {limits?.services === Infinity ? "∞" : (limits?.services ?? 0)}</span>
                </div>
                <Progress value={limits?.services === Infinity ? 100 : Math.min(((usage?.services || 0) / (limits?.services || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Produtos</span>
                  <span className="font-bold">{usage?.products ?? 0} / {limits?.products === Infinity ? "∞" : (limits?.products ?? 0)}</span>
                </div>
                <Progress value={limits?.products === Infinity ? 100 : Math.min(((usage?.products || 0) / (limits?.products || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agendamentos</span>
                  <span className="font-bold">{usage?.monthlyAppointments ?? 0} / {limits?.monthlyAppointments === Infinity ? "∞" : (limits?.monthlyAppointments ?? 0)}</span>
                </div>
                <Progress value={limits?.monthlyAppointments === Infinity ? 100 : Math.min(((usage?.monthlyAppointments || 0) / (limits?.monthlyAppointments || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span className="font-bold">{usage?.whatsappConnections ?? 0} / {limits?.whatsappConnections === Infinity ? "∞" : (limits?.whatsappConnections ?? 0)}</span>
                </div>
                <Progress value={limits?.whatsappConnections === Infinity ? 100 : Math.min(((usage?.whatsappConnections || 0) / (limits?.whatsappConnections || 1)) * 100, 100)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {planConfigs.map((config) => {
              let isCurrentPlan = false;
              let isUpgrade = false;
              let isDowngrade = false;

              try {
                const currentPlanIndex = planConfigs.findIndex(c => c.id === plan);
                const configIndex = planConfigs.findIndex(c => c.id === config.id);
                
                isCurrentPlan = plan === config.id;
                isUpgrade = currentPlanIndex < configIndex;
                isDowngrade = currentPlanIndex > configIndex;
              } catch (e) {
                console.error("[Subscription] Error calculating plan status:", e);
              }

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
        <DialogContent className="max-w-3xl min-h-[600px] h-[80vh] overflow-y-auto p-0 flex flex-col sm:rounded-xl">
          <DialogHeader className="p-6 pb-2 border-b shrink-0">
            <DialogTitle>Finalizar assinatura</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full overflow-y-auto bg-white custom-stripe-container min-h-[500px] p-4 sm:p-6">
            {checkoutElement || (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}