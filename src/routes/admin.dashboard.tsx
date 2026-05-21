import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { 
  Users, 
  Building2, 
  CreditCard, 
  CircleDollarSign, 
  TrendingUp, 
  Wallet,
  CalendarCheck,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AdminChartsTab } from "@/components/admin/AdminChartsTab";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Fetch Tenants (Profiles)
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, plan, created_at");
      
      if (pError) throw pError;
      if (!profiles) return null;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const tenantIds = new Set(
        (roles || [])
          .filter((entry) => entry.role === 'tenant_admin')
          .map((entry) => entry.user_id)
      );

      const tenants = profiles.filter((profile) => tenantIds.has(profile.id));
      
      // Fetch Plans
      const { data: plans } = await supabase.from("plans").select("*");
      
      // Fetch Appointments (for total transacted)
      const { data: appointments } = await supabase
        .from("appointments")
        .select("final_amount, cashback_earned, credit_used")
        .eq("status", "completed"); // Fixed: status is 'completed', not 'concluded'

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
      const mrr = tenants.reduce((acc, t) => {
        const plan = plans?.find(p => p.name.toLowerCase() === t.plan?.toLowerCase());
        return acc + (plan ? Number(plan.price_monthly) : 0);
      }, 0);

      const totalTransacted = appointments?.reduce((acc, curr) => acc + (curr.final_amount || 0), 0) || 0;
      const totalCashback = appointments?.reduce((acc, curr) => acc + (curr.cashback_earned || 0), 0) || 0;
      const totalCredits = customers?.reduce((acc, curr) => acc + (curr.credits || 0), 0) || 0;
      const totalCustomers = customers?.length || 0;

      return {
        totalTenants,
        activeSubs,
        mrr,
        totalTransacted,
        totalCashback,
        totalCredits,
        totalCustomers,
        totalBarbers: barberCount || 0
      };
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isError) {
    return (
      <div className="p-8 text-center bg-destructive/10 rounded-xl border border-destructive/20">
        <h3 className="text-xl font-bold text-destructive mb-2">Erro ao carregar métricas</h3>
        <p className="text-muted-foreground">{(error as Error)?.message || "Ocorreu um erro inesperado."}</p>
      </div>
    );
  }

  const statCards = [
    { label: "Total Barbearias", value: stats?.totalTenants ?? 0, icon: Building2, color: "text-blue-600", trend: "+3 este mês", isPositive: true },
    { label: "Assinaturas Ativas", value: stats?.activeSubs ?? 0, icon: CreditCard, color: "text-green-600", trend: "+12%", isPositive: true },
    { label: "MRR Estimado", value: `R$ ${(stats?.mrr ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-600", trend: "+R$ 450", isPositive: true },
    { label: "Total Transacionado", value: `R$ ${(stats?.totalTransacted ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CircleDollarSign, color: "text-amber-600", trend: "+18%", isPositive: true },
    { label: "Cashback Emitido", value: `R$ ${(stats?.totalCashback ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Award, color: "text-purple-600" },
    { label: "Créditos Ativos", value: `R$ ${(stats?.totalCredits ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Wallet, color: "text-orange-600" },
    { label: "Total de Clientes", value: stats?.totalCustomers ?? 0, icon: Users, color: "text-cyan-600", trend: "+156", isPositive: true },
    { label: "Total de Barbeiros", value: stats?.totalBarbers ?? 0, icon: CalendarCheck, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Global</h2>
          <p className="text-muted-foreground">
            Métricas consolidadas da plataforma SaaS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Nova Barbearia
          </Button>
        </div>
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
            <Card key={i} className="hover:shadow-lg transition-all cursor-default group border-primary/5 hover:border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                  {stat.label}
                </CardTitle>
                <div className={cn("p-2 rounded-lg bg-background shadow-sm border group-hover:scale-110 transition-transform")}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                {stat.trend && (
                  <div className="flex items-center mt-1">
                    {stat.isPositive ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-rose-500 mr-1" />
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      stat.isPositive ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {stat.trend}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-6">
        <AdminChartsTab />
      </div>
    </div>
  );
}
