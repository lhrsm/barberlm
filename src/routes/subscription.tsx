import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits, PLAN_LIMITS } from "@/hooks/use-plan-limits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscription")({
  component: SubscriptionComponent,
});

function SubscriptionComponent() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { plan, usage, limits, refresh } = usePlanLimits();

  const handleUpgrade = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({ plan: "pro" })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao atualizar plano");
    } else {
      toast.success("Parabéns! Agora você é Pro.");
      refresh();
    }
  };

  const handleDowngrade = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({ plan: "free" })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao atualizar plano");
    } else {
      toast.success("Plano alterado para Grátis");
      refresh();
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assinatura</h2>
          <p className="text-muted-foreground">Gerencie seu plano e limites do sistema.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Plan Status */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Plano Atual: <span className="capitalize text-primary">{plan}</span></CardTitle>
                <CardDescription>Veja como está o uso dos seus recursos este mês.</CardDescription>
              </div>
              {plan === 'pro' ? <Crown className="text-yellow-500 w-8 h-8" /> : <Zap className="text-blue-500 w-8 h-8" />}
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Profissionais</span>
                  <span className="font-medium">{usage.barbers} / {limits.barbers === Infinity ? "∞" : limits.barbers}</span>
                </div>
                <Progress value={limits.barbers === Infinity ? 100 : (usage.barbers / limits.barbers) * 100} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Serviços</span>
                  <span className="font-medium">{usage.services} / {limits.services === Infinity ? "∞" : limits.services}</span>
                </div>
                <Progress value={limits.services === Infinity ? 100 : (usage.services / limits.services) * 100} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Agendamentos Mensais</span>
                  <span className="font-medium">{usage.monthlyAppointments} / {limits.monthlyAppointments === Infinity ? "∞" : limits.monthlyAppointments}</span>
                </div>
                <Progress value={limits.monthlyAppointments === Infinity ? 100 : (usage.monthlyAppointments / limits.monthlyAppointments) * 100} />
              </div>
            </CardContent>
          </Card>

          {/* Free Plan Card */}
          <Card className={cn(plan === 'free' && "border-primary")}>
            <CardHeader>
              <CardTitle>Grátis</CardTitle>
              <CardDescription>Ideal para quem está começando agora.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" /> {PLAN_LIMITS.free.barbers} Profissional
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" /> {PLAN_LIMITS.free.services} Serviços
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" /> {PLAN_LIMITS.free.monthlyAppointments} Agendamentos/mês
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant={plan === 'free' ? "outline" : "default"} 
                className="w-full" 
                disabled={plan === 'free'}
                onClick={handleDowngrade}
              >
                {plan === 'free' ? "Plano Atual" : "Mudar para Grátis"}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Plan Card */}
          <Card className={cn(plan === 'pro' && "border-primary bg-primary/5")}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Profissional (Pro)</CardTitle>
                  <CardDescription>Tudo o que sua barbearia precisa para crescer.</CardDescription>
                </div>
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">R$ 49,90<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm font-medium">
                  <Check className="w-4 h-4 text-green-500" /> Profissionais Ilimitados
                </li>
                <li className="flex items-center gap-2 text-sm font-medium">
                  <Check className="w-4 h-4 text-green-500" /> Serviços Ilimitados
                </li>
                <li className="flex items-center gap-2 text-sm font-medium">
                  <Check className="w-4 h-4 text-green-500" /> Agendamentos Ilimitados
                </li>
                <li className="flex items-center gap-2 text-sm font-medium">
                  <Check className="w-4 h-4 text-green-500" /> Relatórios Financeiros Avançados
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant={plan === 'pro' ? "outline" : "default"} 
                className="w-full bg-primary hover:bg-primary/90" 
                disabled={plan === 'pro'}
                onClick={handleUpgrade}
              >
                {plan === 'pro' ? "Plano Atual" : "Upgrade para Pro"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
