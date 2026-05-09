import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Building2, 
  CreditCard, 
  CircleDollarSign, 
  TrendingUp, 
  Wallet,
  CalendarCheck,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Fetch Tenants (Profiles)
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, plan, created_at, role");
      
      if (pError) throw pError;

      // Filter out super admins if any
      const tenants = profiles.filter(p => p.role !== 'super_admin');
      
      // Fetch Plans
      const { data: plans } = await supabase.from("plans").select("*");
      
      // Fetch Appointments (for total transacted)
      const { data: appointments } = await supabase
        .from("appointments")
        .select("final_amount, cashback_earned, credit_used")
        .eq("status", "concluded");

      // Fetch Customers (for credits and total count)
      const { data: customers } = await supabase
        .from("customers")
        .select("credits, cashback_balance");

      // Fetch Barbers
      const { count: barberCount } = await supabase
        .from("barbers")
        .select("*", { count: 'exact', head: true });

      // Calculations
      const totalTenants = tenants.length;
      const activeSubs = tenants.filter(t => t.plan && t.plan.toLowerCase() !== 'free').length;
      const canceledSubs = 0; // In a real system, we'd check a subscription status column

      // Estimate MRR
      let mrr = 0;
      tenants.forEach(t => {
        const plan = plans?.find(p => p.name.toLowerCase() === t.plan?.toLowerCase());
        if (plan) mrr += Number(plan.price_monthly);
      });

      const totalTransacted = appointments?.reduce((acc, curr) => acc + (curr.final_amount || 0), 0) || 0;
      const totalCashback = appointments?.reduce((acc, curr) => acc + (curr.cashback_earned || 0), 0) || 0;
      const totalCredits = customers?.reduce((acc, curr) => acc + (curr.credits || 0), 0) || 0;
      const totalCustomers = customers?.length || 0;

      return {
        totalTenants,
        activeSubs,
        canceledSubs,
        mrr,
        totalTransacted,
        totalCashback,
        totalCredits,
        totalCustomers,
        totalBarbers: barberCount || 0
      };
    }
  });

  const statCards = [
    { label: "Total Barbearias", value: stats?.totalTenants, icon: Building2, color: "text-blue-600" },
    { label: "Assinaturas Ativas", value: stats?.activeSubs, icon: CreditCard, color: "text-green-600" },
    { label: "MRR Estimado", value: `R$ ${stats?.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Total Transacionado", value: `R$ ${stats?.totalTransacted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CircleDollarSign, color: "text-amber-600" },
    { label: "Cashback Emitido", value: `R$ ${stats?.totalCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Award, color: "text-purple-600" },
    { label: "Créditos Ativos", value: `R$ ${stats?.totalCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Wallet, color: "text-orange-600" },
    { label: "Total de Clientes", value: stats?.totalCustomers, icon: Users, color: "text-cyan-600" },
    { label: "Total de Barbeiros", value: stats?.totalBarbers, icon: CalendarCheck, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Global</h2>
        <p className="text-muted-foreground underline decoration-primary/30 underline-offset-4">
          Métricas consolidadas de toda a plataforma SaaS.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px] mb-1" />
                <Skeleton className="h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow cursor-default group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {stat.label}
                </CardTitle>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Crescimento</CardTitle>
            <CardDescription>Visualização rápida de novas barbearias por mês.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground italic border-t mt-2">
            Gráfico de barras (implementar com Recharts futuramente)
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Distribuição de Planos</CardTitle>
            <CardDescription>Porcentagem de usuários em cada nível.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground italic border-t mt-2">
            Gráfico de pizza (implementar com Recharts futuramente)
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
