import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS, PlanType } from "@/hooks/use-plan-limits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap, ShieldAlert, Star, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/subscription")({
  component: SubscriptionComponent,
});

function SubscriptionComponent() {
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const { plan, usage, limits, refresh } = usePlanLimits();
  const [updating, setUpdating] = useState(false);

  const handlePlanChange = async (newPlan: PlanType) => {
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }
    setUpdating(true);
    
    console.log("Attempting to change plan to:", newPlan, "for user:", user.id);
    
    try {
      const { error, status } = await supabase
        .from("profiles")
        .update({ plan: newPlan })
        .eq("id", user.id);

      if (error) {
        console.error("Plan update error:", error.message, "Code:", error.code, "Status:", status);
        toast.error(`Erro ao atualizar plano: ${error.message}`);
      } else {
        const planNames = {
          free: "Grátis",
          starter: "Starter",
          pro: "Pro",
          elite: "Elite"
        };
        toast.success(`Plano alterado para ${planNames[newPlan]}!`);
        await refresh();
      }
    } catch (e: any) {
      console.error("Plan update exception:", e);
      toast.error("Erro inesperado ao atualizar plano.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setUpdating(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({ plan: "free" })
      .eq("id", user.id);

    setUpdating(false);

    if (error) {
      toast.error("Erro ao cancelar assinatura");
    } else {
      toast.success("Assinatura cancelada com sucesso.");
      refresh();
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
      id: "free" as PlanType,
      name: "Grátis",
      price: "0",
      description: "Comece agora com 7 dias de teste gratuito.",
      icon: <Zap className="text-blue-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.free.barbers} Profissional`,
        `${PLAN_LIMITS.free.services} Serviços`,
        `${PLAN_LIMITS.free.products} Produtos`,
        `${PLAN_LIMITS.free.monthlyAppointments} Agendamentos/mês`,
        "1 Conexão WhatsApp",
      ],
      buttonText: "Plano Atual",
      color: "blue"
    },
    {
      id: "basic" as PlanType,
      name: "Básico",
      price: "19,90",
      description: "Ideal para profissionais liberais.",
      icon: <Star className="text-green-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.basic.barbers} Profissionais`,
        `${PLAN_LIMITS.basic.services} Serviços`,
        `${PLAN_LIMITS.basic.products} Produtos`,
        `${PLAN_LIMITS.basic.monthlyAppointments} Agendamentos/mês`,
        "1 Conexão WhatsApp",
      ],
      buttonText: "Upgrade para Básico",
      color: "green"
    },
    {
      id: "intermediate" as PlanType,
      name: "Intermediário",
      price: "39,90",
      description: "Perfeito para pequenas barbearias.",
      icon: <Rocket className="text-purple-500 w-5 h-5" />,
      features: [
        `${PLAN_LIMITS.intermediate.barbers} Profissionais`,
        `${PLAN_LIMITS.intermediate.services} Serviços`,
        `${PLAN_LIMITS.intermediate.products} Produtos`,
        `${PLAN_LIMITS.intermediate.monthlyAppointments} Agendamentos/mês`,
        "Até 3 Conexões WhatsApp",
        "Gateway de Pagamento",
      ],
      buttonText: "Upgrade para Intermediário",
      color: "purple"
    },
    {
      id: "pro" as PlanType,
      name: "Pró",
      price: "59,90",
      description: "A solução completa sem limites.",
      icon: <Crown className="text-yellow-500 w-5 h-5" />,
      features: [
        "Profissionais Ilimitados",
        "Serviços Ilimitados",
        "Produtos Ilimitados",
        "Agendamentos Ilimitados",
        "Conexões WhatsApp Ilimitadas",
        "Gateway de Pagamento Liberado",
      ],
      buttonText: "Upgrade para Pró",
      color: "yellow"
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Assinatura</h2>
            <p className="text-muted-foreground">Gerencie seu plano e limites do sistema.</p>
          </div>
          {plan !== 'free' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                  Cancelar Assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sua assinatura será cancelada e você voltará ao plano gratuito ao final do período.
                    Seus dados e configurações serão mantidos, mas as limitações do plano grátis serão aplicadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="grid gap-6">
          {/* Plan Status */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano Atual: <span className="capitalize text-primary font-bold">{plan === 'free' ? 'Grátis' : plan === 'basic' ? 'Básico' : plan === 'intermediate' ? 'Intermediário' : 'Pró'}</span>
                  {plan === 'pro' && <Crown className="text-yellow-500 w-5 h-5" />}
                </CardTitle>
                <CardDescription>Acompanhe o uso dos seus recursos.</CardDescription>
              </div>
              <div className="bg-background/50 px-3 py-1 rounded-full border text-xs font-medium">
                {plan === 'free' ? '7 Dias de Teste Ativos' : 'Assinatura Ativa'}
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
    </AppLayout>
  );
}