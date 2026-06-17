import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS, PlanType } from "@/hooks/use-plan-limits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap, ShieldAlert, Star, Rocket, Clock, Loader2, AlertCircle, AlertTriangle, CreditCard, Scale, X, ArrowDownCircle } from "lucide-react";
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


// IDs reais dos preços no Stripe (cadastrados na sua conta).
// Sandbox: usamos lookup keys; Live: usamos os price IDs reais.
const PLAN_PRICE_IDS: Record<'sandbox' | 'live', Record<string, string>> = {
  sandbox: {
    starter: "starter_monthly",
    professional: "professional_monthly",
    elite: "elite_monthly",
    enterprise: "enterprise_monthly",
  },
  live: {
    starter: "price_1TVtOWPKG6q10UjrQErPgyKO",
    professional: "price_1TVtOVPKG6q10Ujre6zMGYpk",
    elite: "price_1TVtgWPKG6q10UjrxRUCnyg1",
    enterprise: "",
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanType | null>(null);

  const planRank: Record<string, number> = { free: 0, starter: 1, pro: 2, professional: 2, elite: 3, enterprise: 4 };

  const requestPlanChange = (newPlan: PlanType) => {
    const current = planRank[plan ?? 'free'] ?? 0;
    const target = planRank[newPlan] ?? 0;
    if (target < current) {
      setDowngradeTarget(newPlan);
      return;
    }
    handlePlanChange(newPlan);
  };



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
      // Mapeia legado: 'pro' -> 'professional'
      const planKey = (newPlan === 'pro' ? 'professional' : newPlan) as string;
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

  // Valores reais dos planos (sincronizados com a tabela `plans`).
  const planConfigs = [
    {
      id: "starter" as PlanType,
      name: "Starter",
      price: "49,90",
      description: "Ideal para profissionais individuais.",
      icon: <Zap className="text-amber-500 w-5 h-5" />,
      features: [
        "1 Profissional",
        "Serviços Ilimitados",
        "Agenda completa",
        "Cadastro de clientes",
        "Financeiro básico",
      ],
      highlight: false,
    },
    {
      id: "professional" as PlanType,
      name: "Professional",
      price: "99,90",
      description: "Para barbearias em crescimento.",
      icon: <Crown className="text-amber-500 w-5 h-5" />,
      features: [
        "Até 5 Profissionais",
        "Comissões e fechamentos",
        "Programa de Fidelidade",
        "Campanhas e Cupons",
        "WhatsApp integrado",
      ],
      highlight: true,
    },
    {
      id: "elite" as PlanType,
      name: "Elite",
      price: "149,90",
      description: "Operação completa, sem limites.",
      icon: <Rocket className="text-amber-500 w-5 h-5" />,
      features: [
        "Profissionais Ilimitados",
        "Clube de Assinaturas",
        "Cashback e Produtos",
        "Automações WhatsApp",
        "Integrações + PIX",
      ],
      highlight: false,
    },
    {
      id: "enterprise" as PlanType,
      name: "Enterprise",
      price: "249,90",
      description: "Multi-unidade e white-label.",
      icon: <Crown className="text-amber-500 w-5 h-5" />,
      features: [
        "Tudo do Elite",
        "Multi-unidades",
        "White-label",
        "Acesso à API",
        "Relatórios corporativos",
      ],
      highlight: false,
    },
  ];


  return (
    <AppLayout>
      <PaymentTestModeBanner />
      <div className="min-h-screen bg-[#05070d] text-white max-w-full overflow-x-hidden">
        <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          {/* HEADER */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start sm:items-center gap-4">
              <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 grid place-items-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight break-words sm:truncate">
                  Minha Assinatura
                </h1>
                <p className="text-sm text-zinc-400 mt-1 break-words sm:truncate">
                  Gerencie seu plano e limites do sistema
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={() => setCompareOpen(true)}
                className="w-full sm:w-auto shrink-0 bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" /> Ver Comparativo
              </Button>
              {plan !== 'free' && (
                <Button
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={updating}
                  className="w-full sm:w-auto shrink-0 bg-[#0b0f17] border border-zinc-700 text-white hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 font-bold text-xs h-11 sm:h-9 rounded-[14px] sm:rounded-md px-3 transition-all"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5 mr-1.5" />}
                  Gerenciar Assinatura
                </Button>
              )}
            </div>

          </header>

          {/* Status Alerts */}
          {isTrial && (
            <div className="bg-[#0b0f17] border border-sky-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_28px_rgba(56,189,248,0.10)]">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 grid place-items-center shrink-0">
                  <Clock className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Seu período de teste expira em {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Assine agora para continuar com todos os recursos Pro.</p>
                </div>
              </div>
              <Button onClick={() => handlePlanChange('pro')} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-[0_4px_16px_rgba(16,185,129,0.3)] whitespace-nowrap">
                Assinar Plano Pro
              </Button>
            </div>
          )}

          {subscription?.status === 'past_due' && (
            <StatusBanner tone="amber" icon={AlertTriangle} title="Pagamento Pendente" desc="Houve um problema com a última cobrança. Atualize sua forma de pagamento.">
              <Button size="sm" onClick={handleManageSubscription} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
                <CreditCard className="w-4 h-4 mr-2" /> Atualizar Cartão
              </Button>
            </StatusBanner>
          )}
          {subscription?.status === 'unpaid' && (
            <StatusBanner tone="red" icon={ShieldAlert} title="Assinatura Suspensa" desc="Sua assinatura está inativa por falhas recorrentes. Recursos premium bloqueados.">
              <Button size="sm" onClick={handleManageSubscription} className="bg-red-500 hover:bg-red-400 text-white font-bold">
                Regularizar Agora
              </Button>
            </StatusBanner>
          )}
          {subscription?.status === 'canceled' && (
            <StatusBanner tone="zinc" icon={AlertCircle} title="Assinatura Cancelada" desc="Sua assinatura anterior foi cancelada. Escolha um novo plano abaixo." />
          )}
          {subscription?.status === 'incomplete' && (
            <StatusBanner tone="sky" icon={Loader2} title="Checkout Pendente" desc="Você tem uma assinatura que ainda não foi concluída. Finalize o pagamento.">
              <Button size="sm" onClick={handleManageSubscription} className="bg-sky-500 hover:bg-sky-400 text-white font-bold">
                Finalizar Pagamento
              </Button>
            </StatusBanner>
          )}

          {/* PLANO ATUAL */}
          <div className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5 md:p-6 shadow-[0_8px_28px_rgba(16,185,129,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
                  {plan === 'elite' ? <Rocket className="h-5 w-5 text-emerald-400" /> :
                   plan === 'pro' ? <Crown className="h-5 w-5 text-emerald-400" /> :
                   plan === 'starter' ? <Zap className="h-5 w-5 text-emerald-400" /> :
                   <Star className="h-5 w-5 text-emerald-400" />}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plano Atual</div>
                  <div className="text-xl font-black text-white">
                    {plan === 'starter' ? 'Starter' :
                     (plan === 'pro' || (plan as any) === 'professional') ? 'Professional' :
                     plan === 'elite' ? 'Elite' :
                     (plan as any) === 'enterprise' ? 'Enterprise' :
                     (!plan || plan === 'free') ? 'Grátis' : plan}
                  </div>
                </div>
              </div>
              <div className={cn(
                "w-full sm:w-auto h-[34px] sm:h-auto px-3 py-1.5 rounded-xl sm:rounded-lg border text-[10px] font-black uppercase tracking-widest grid place-items-center text-center",
                subscription?.status === 'active' || (!subscription?.status && plan !== 'free') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                subscription?.status === 'trialing' ? "bg-sky-500/10 text-sky-400 border-sky-500/30" :
                subscription?.status === 'past_due' ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                subscription?.status === 'unpaid' ? "bg-red-500/10 text-red-400 border-red-500/30" :
                "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
              )}>
                {subscription?.status === 'active' ? 'Assinatura Ativa' :
                 subscription?.status === 'trialing' ? 'Período de Teste' :
                 subscription?.status === 'past_due' ? 'Pagamento Pendente' :
                 subscription?.status === 'unpaid' ? 'Inadimplente' :
                 subscription?.status === 'canceled' ? 'Cancelada' :
                 plan === 'free' ? 'Plano Gratuito' : 'Assinatura Ativa'}
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-5">
              <UsageBar label="Profissionais" used={usage?.barbers ?? 0} limit={limits?.barbers} />
              <UsageBar label="Serviços" used={usage?.services ?? 0} limit={limits?.services} />
              <UsageBar label="Produtos" used={usage?.products ?? 0} limit={limits?.products} />
              <UsageBar label="Agendamentos" used={usage?.monthlyAppointments ?? 0} limit={limits?.monthlyAppointments} />
              <UsageBar label="WhatsApp" used={usage?.whatsappConnections ?? 0} limit={limits?.whatsappConnections} />
            </div>
          </div>

          {/* PLANOS DISPONÍVEIS */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Planos Disponíveis</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 pt-4">
              {planConfigs.map((config) => {
                let isCurrentPlan = false;
                let isUpgrade = false;
                try {
                  const currentPlanIndex = planConfigs.findIndex(c => c.id === plan);
                  const configIndex = planConfigs.findIndex(c => c.id === config.id);
                  isCurrentPlan = plan === config.id;
                  isUpgrade = currentPlanIndex < configIndex;
                } catch {}
                const Icon = config.id === 'starter' ? Zap : config.id === 'pro' ? Crown : Rocket;

                return (
                  <div
                    key={config.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1",
                      isCurrentPlan
                        ? "bg-gradient-to-b from-emerald-500/10 to-[#0b0f17] border-2 border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.25)]"
                        : "bg-[#0b0f17] border border-zinc-800/80 hover:border-emerald-500/30 hover:shadow-[0_8px_28px_rgba(16,185,129,0.12)]"
                    )}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_4px_16px_rgba(16,185,129,0.4)] whitespace-nowrap">
                        Plano Atual
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Plano</div>
                        <h3 className="text-2xl font-black tracking-tight text-white">{config.name}</h3>
                      </div>
                      <div className={cn(
                        "h-11 w-11 rounded-xl grid place-items-center border",
                        isCurrentPlan
                          ? "bg-emerald-500/15 border-emerald-500/30"
                          : "bg-zinc-800/50 border-zinc-700/50"
                      )}>
                        <Icon className={cn("h-5 w-5", isCurrentPlan ? "text-emerald-400" : "text-zinc-400")} />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 min-h-[32px]">{config.description}</p>

                    <div className="my-5 py-4 border-y border-zinc-800/80">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-zinc-500 font-bold">R$</span>
                        <span className="text-4xl font-black tracking-tight text-white">{config.price}</span>
                        <span className="text-xs text-zinc-500 font-bold ml-1">/mês</span>
                      </div>
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-5">
                      {config.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className={cn(
                            "h-4 w-4 rounded-full grid place-items-center mt-0.5 shrink-0",
                            isCurrentPlan ? "bg-emerald-500/20" : "bg-zinc-800"
                          )}>
                            <Check className={cn("w-2.5 h-2.5", isCurrentPlan ? "text-emerald-400" : "text-zinc-400")} />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled={isCurrentPlan || updating}
                      onClick={() => requestPlanChange(config.id)}
                      className={cn(
                        "w-full h-11 rounded-xl font-bold text-sm transition-all",
                        isCurrentPlan
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-100 cursor-default"
                          : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
                      )}
                    >
                      {updating && !isCurrentPlan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {isCurrentPlan ? "✓ Plano Ativo" : isUpgrade ? `Fazer Upgrade para ${config.name}` : `Fazer Downgrade para ${config.name}`}
                    </Button>
                  </div>
                );
              })}
            </div>
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

      {/* COMPARATIVO DE PLANOS */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#0b0f17] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-emerald-400" /> Comparativo de Planos
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-3 font-bold text-zinc-400 text-xs uppercase tracking-wider">Recurso</th>
                  <th className="text-center py-3 px-3 font-black text-white">Starter</th>
                  <th className="text-center py-3 px-3 font-black text-emerald-400">Pro</th>
                  <th className="text-center py-3 px-3 font-black text-white">Elite</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-zinc-800/60">
                <tr><td className="py-3 px-3 text-zinc-300">Preço mensal</td><td className="text-center font-bold">R$ 19,90</td><td className="text-center font-bold text-emerald-400">R$ 39,90</td><td className="text-center font-bold">R$ 59,90</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Profissionais</td><td className="text-center">{PLAN_LIMITS.starter.barbers}</td><td className="text-center text-emerald-400">{PLAN_LIMITS.pro.barbers}</td><td className="text-center">∞</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Serviços</td><td className="text-center">∞</td><td className="text-center text-emerald-400">∞</td><td className="text-center">∞</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Produtos</td><td className="text-center">∞</td><td className="text-center text-emerald-400">∞</td><td className="text-center">∞</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Agendamentos</td><td className="text-center">∞</td><td className="text-center text-emerald-400">∞</td><td className="text-center">∞</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Conexões WhatsApp</td><td className="text-center">1</td><td className="text-center text-emerald-400">2</td><td className="text-center">∞</td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Financeiro Completo</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Automações WhatsApp</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Programa de Fidelidade</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Assinaturas / Clube</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Relatórios Avançados</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
                <tr><td className="py-3 px-3 text-zinc-300">Suporte Prioritário</td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><X className="inline w-4 h-4 text-zinc-600" /></td><td className="text-center"><Check className="inline w-4 h-4 text-emerald-400" /></td></tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* DOWNGRADE CONFIRMATION */}
      <AlertDialog open={!!downgradeTarget} onOpenChange={(o) => { if (!o) setDowngradeTarget(null); }}>
        <AlertDialogContent className="bg-[#0b0f17] border-amber-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <ArrowDownCircle className="h-5 w-5 text-amber-400" />
              Confirmar Downgrade
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <span className="block">Você está prestes a mudar para um plano inferior ({downgradeTarget?.toUpperCase()}). Ao confirmar, você perderá acesso aos seguintes recursos:</span>
              <ul className="list-disc list-inside text-amber-300/90 space-y-1 text-sm">
                {downgradeTarget === 'starter' && (
                  <>
                    <li>Financeiro completo, comissões e fechamentos</li>
                    <li>Automações de WhatsApp e campanhas</li>
                    <li>Programa de fidelidade</li>
                    <li>Múltiplos profissionais (limite de 1)</li>
                    <li>Relatórios avançados</li>
                  </>
                )}
                {downgradeTarget === 'pro' && (
                  <>
                    <li>Clube de assinaturas / planos recorrentes para clientes</li>
                    <li>Profissionais ilimitados (limite de {PLAN_LIMITS.pro.barbers})</li>
                    <li>Conexões WhatsApp ilimitadas (limite de 2)</li>
                    <li>Suporte prioritário</li>
                  </>
                )}
              </ul>
              <span className="block text-xs text-zinc-500">Dados existentes não serão apagados, mas funcionalidades premium ficarão bloqueadas.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = downgradeTarget;
                setDowngradeTarget(null);
                if (target) handlePlanChange(target);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Confirmar Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>

  );
}

function StatusBanner({
  tone,
  icon: Icon,
  title,
  desc,
  children,
}: {
  tone: "amber" | "red" | "zinc" | "sky";
  icon: any;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  const map = {
    amber: { border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-[0_8px_28px_rgba(245,158,11,0.10)]" },
    red:   { border: "border-red-500/30",   bg: "bg-red-500/10",   text: "text-red-400",   glow: "shadow-[0_8px_28px_rgba(239,68,68,0.10)]" },
    zinc:  { border: "border-zinc-700/60",  bg: "bg-zinc-500/10",  text: "text-zinc-400",  glow: "" },
    sky:   { border: "border-sky-500/30",   bg: "bg-sky-500/10",   text: "text-sky-400",   glow: "shadow-[0_8px_28px_rgba(56,189,248,0.10)]" },
  }[tone];
  return (
    <div className={cn("bg-[#0b0f17] border rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4", map.border, map.glow)}>
      <div className="flex items-center gap-4">
        <div className={cn("h-11 w-11 rounded-xl grid place-items-center shrink-0 border", map.bg, map.border)}>
          <Icon className={cn("h-5 w-5", map.text)} />
        </div>
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | undefined }) {
  const isInf = limit === Infinity;
  const max = isInf ? 100 : (limit ?? 0);
  const pct = isInf ? 100 : Math.min((used / (max || 1)) * 100, 100);
  return (
    <div className="bg-[#05070d]/60 border border-zinc-800/60 rounded-2xl min-h-[92px] p-[14px] flex flex-col justify-between">
      <div className="flex justify-between items-baseline mb-2 gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">{label}</span>
        <span className="text-xs font-black text-emerald-400 whitespace-nowrap shrink-0">
          {used} / {isInf ? "∞" : max}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-1.5 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400"
      />
    </div>
  );
}
