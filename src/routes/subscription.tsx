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

const PLAN_PRICE_IDS = {
  sandbox: {
    starter: "starter_monthly", // Lookup keys para ambiente de teste
    pro: "pro_monthly",
    elite: "elite_monthly",
  },
  live: {
    starter: "price_1TVtOWPKG6q10UjrQErPgyKO",
    pro: "price_1TVtOVPKG6q10Ujre6zMGYpk",
    elite: "price_1TVtgWPKG6q10UjrxRUCnyg1",
  }
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
    console.log("[Subscription] 👆 Clique em handlePlanChange:", { newPlan, currentPlan: plan });
    
    if (!user) {
      console.warn("[Subscription] ❌ Usuário não logado");
      toast.error("Você precisa estar logado.");
      return;
    }

    if (newPlan === 'free') {
      console.log("[Subscription] ℹ️ Plano free selecionado, ignorando checkout");
      return;
    }

    setUpdating(true); // Ativa loading global para evitar múltiplos cliques
    
    try {
      // Buscar configurações globais para verificar se o modo teste está forçado
      const { data: systemSettings } = await supabase.from("system_settings").select("payments_test_mode").limit(1).single();
      const forcedTestMode = systemSettings?.payments_test_mode;

      const env = forcedTestMode ? 'sandbox' : getStripeEnvironment();
      const planKey = newPlan as keyof typeof PLAN_PRICE_IDS['live'];
      const priceId = PLAN_PRICE_IDS[env][planKey];
      
      console.log("[Subscription] 🆔 Configuração de checkout:", { 
        env, 
        plan: newPlan, 
        priceId 
      });
      
      if (!priceId) {
        throw new Error(`Price ID não configurado para o plano ${newPlan} no ambiente ${env}`);
      }
      
      console.log("[Subscription] 🚀 Abrindo modal de checkout...");
      openCheckout({
        priceId,
        customerEmail: user.email,
        userId: user.id,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (err: any) {
      console.error("[Subscription] ❌ Erro ao iniciar o checkout:", err);
      toast.error(err.message || "Erro ao iniciar o checkout.");
    } finally {
      // Pequeno delay para garantir que o modal abra antes de remover o loading do botão
      setTimeout(() => setUpdating(false), 500);
    }
  };


  const handleManageSubscription = async () => {
    setUpdating(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      if (!token) throw new Error("Você precisa estar logado.");

      const url = await createPortalSession({
        data: {
          returnUrl: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
        headers: {
          Authorization: `Bearer ${token}`,
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
      icon: <Zap className="text-amber-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.starter.barbers} Profissional`,
        `Serviços Ilimitados`,
        `Produtos Ilimitados`,
        `Agendamentos Ilimitados`,
        "1 Conexão WhatsApp",
      ],
      buttonText: "Assinar Starter",
      color: "amber"
    },
    {
      id: "pro" as PlanType,
      name: "Pro",
      price: "39,90",
      description: "Perfeito para barbearias em crescimento.",
      icon: <Crown className="text-amber-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.pro.barbers} Profissionais`,
        `Serviços Ilimitados`,
        `Produtos Ilimitados`,
        `Agendamentos Ilimitados`,
        "2 Conexões WhatsApp",
        "Financeiro Completo",
      ],
      buttonText: "Assinar Pro",
      color: "amber"
    },
    {
      id: "elite" as PlanType,
      name: "Elite",
      price: "59,90",
      description: "A solução definitiva sem limites.",
      icon: <Rocket className="text-amber-500 w-5 h-5" />,
      features: [
        "Profissionais Ilimitados",
        "Serviços Ilimitados",
        "Produtos Ilimitados",
        "Agendamentos Ilimitados",
        "Conexões WhatsApp Ilimitadas",
        "Suporte Prioritário",
      ],
      buttonText: "Assinar Elite",
      color: "amber"
    }
  ];

  return (
    <AppLayout>
      <PaymentTestModeBanner />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black italic tracking-tighter text-amber-500 uppercase">Assinatura</h2>
            <p className="text-muted-foreground font-medium italic">Gerencie seu plano e limites do sistema de forma profissional.</p>
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
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white hover:scale-105 active:scale-95 shadow-xl transition-all rounded-2xl font-black italic uppercase tracking-wider whitespace-nowrap" onClick={() => handlePlanChange('pro')}>
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
                <Button className="bg-black text-white hover:scale-105 rounded-xl" onClick={handleManageSubscription}>
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
                <Button className="bg-black text-white hover:scale-105 rounded-xl" onClick={handleManageSubscription}>
                  Finalizar Pagamento
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Plan Status */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
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
                "px-3 py-1 rounded-full border text-xs font-black uppercase italic tracking-widest",
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
            <CardContent className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-primary/10">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Profissionais</span>
                  <span className="font-bold text-primary">{usage?.barbers ?? 0} / {limits?.barbers === Infinity ? "∞" : (limits?.barbers ?? 0)}</span>
                </div>
                <Progress value={limits?.barbers === Infinity ? 100 : Math.min(((usage?.barbers || 0) / (limits?.barbers || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-primary/10">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Serviços</span>
                  <span className="font-bold text-primary">{usage?.services ?? 0} / {limits?.services === Infinity ? "∞" : (limits?.services ?? 0)}</span>
                </div>
                <Progress value={limits?.services === Infinity ? 100 : Math.min(((usage?.services || 0) / (limits?.services || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-primary/10">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Produtos</span>
                  <span className="font-bold text-primary">{usage?.products ?? 0} / {limits?.products === Infinity ? "∞" : (limits?.products ?? 0)}</span>
                </div>
                <Progress value={limits?.products === Infinity ? 100 : Math.min(((usage?.products || 0) / (limits?.products || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-primary/10">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Agendamentos</span>
                  <span className="font-bold text-primary">{usage?.monthlyAppointments ?? 0} / {limits?.monthlyAppointments === Infinity ? "∞" : (limits?.monthlyAppointments ?? 0)}</span>
                </div>
                <Progress value={limits?.monthlyAppointments === Infinity ? 100 : Math.min(((usage?.monthlyAppointments || 0) / (limits?.monthlyAppointments || 1)) * 100, 100)} className="h-1.5" />
              </div>
              <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-primary/10">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">WhatsApp</span>
                  <span className="font-bold text-primary">{usage?.whatsappConnections ?? 0} / {limits?.whatsappConnections === Infinity ? "∞" : (limits?.whatsappConnections ?? 0)}</span>
                </div>
                <Progress value={limits?.whatsappConnections === Infinity ? 100 : Math.min(((usage?.whatsappConnections || 0) / (limits?.whatsappConnections || 1)) * 100, 100)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto py-8">
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
                  "flex flex-col relative transition-all hover:shadow-2xl hover:scale-[1.02] duration-300 bg-card border-2 min-h-[500px] overflow-hidden group",
                  isCurrentPlan && "border-amber-500 shadow-2xl ring-2 ring-amber-500/10 shadow-amber-500/20",
                  !isCurrentPlan && "border-border/50"
                )}>
                  {/* Glow effect for cards */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-amber-500/10 transition-all duration-500" />

                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Plano Atual
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-amber-500">{config.name}</CardTitle>
                      {config.icon}
                    </div>
                    <CardDescription className="min-h-[40px]">{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="flex items-baseline gap-1 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 justify-center">
                      <span className="text-4xl font-black italic tracking-tighter text-amber-500">R$ {config.price}</span>
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
                  <CardFooter className="mt-auto p-6">
                    <Button 
                      variant={isCurrentPlan ? "outline" : "default"}
                      className={cn(
                        "w-full h-12 rounded-2xl font-black italic uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl",
                        isCurrentPlan && "border-amber-500/20 text-amber-500 opacity-50 cursor-not-allowed bg-amber-500/5",
                        !isCurrentPlan && "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
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