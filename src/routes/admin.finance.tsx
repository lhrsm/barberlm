import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  LineChart,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/finance")({
  component: AdminFinance,
});

function AdminFinance() {
  const queryClient = useQueryClient();
  const { data: financeStats, isLoading } = useQuery({
    queryKey: ["admin-finance-stats"],
    queryFn: async () => {
      // Fetch plans to get prices
      const { data: plans } = await supabase.from("plans").select("*");
      
      // Fetch tenants and their plans
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, plan, created_at"),
        supabase
          .from("user_roles")
          .select("user_id, role"),
      ]);

      const tenantIds = new Set(
        (roles || [])
          .filter((entry) => entry.role === 'tenant_admin')
          .map((entry) => entry.user_id)
      );

      const tenants = (profiles || []).filter((profile) => tenantIds.has(profile.id));

      // Calculate MRR
      let totalMRR = 0;
      const planDistribution: Record<string, number> = {};
      
      tenants?.forEach(t => {
        const planName = t.plan?.toUpperCase() || 'FREE';
        const plan = plans?.find(p => p.name === planName);
        if (plan) {
          totalMRR += Number(plan.price_monthly);
          planDistribution[planName] = (planDistribution[planName] || 0) + 1;
        }
      });

      // Fetch transaction history (Global transactions)
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      return {
        totalMRR,
        totalRevenue: totalMRR * 12, // Annualized
        tenantsCount: tenants?.length || 0,
        planDistribution,
        recentTransactions: transactions || []
      };
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-stats"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-stats"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">RECEITA & MRR</h2>
          <p className="text-gray-400 font-medium">Saúde financeira e crescimento recorrente da plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white/5 border-white/10 text-white rounded-2xl h-12 px-6">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600 border-none rounded-2xl h-12 px-6 font-bold">
            Gerar Relatório
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "MRR Recorrente", value: `R$ ${(financeStats?.totalMRR ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-400", trend: "+12.5%", desc: "vs mês anterior" },
          { label: "ARR Projetado", value: `R$ ${(financeStats?.totalRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-blue-400", trend: "+8.2%", desc: "projeção anual" },
          { label: "ARPU Médio", value: `R$ ${financeStats ? (financeStats.totalMRR / (financeStats.tenantsCount || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}`, icon: PieChart, color: "text-purple-400", trend: "+2.1%", desc: "por barbearia" },
          { label: "Churn Rate", value: "1.2%", icon: TrendingDown, color: "text-rose-400", trend: "-0.3%", desc: "cancelamentos" }
        ].map((kpi, i) => (
          <Card key={i} className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{kpi.label}</span>
              <div className={cn("p-2 rounded-xl bg-white/5", kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black tracking-tight mb-2 text-white">{kpi.value}</div>
              <div className="flex items-center gap-1.5">
                <Badge className={cn(
                  "rounded-lg px-1.5 py-0 text-[10px] border-none font-bold",
                  kpi.label === "Churn Rate" ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {kpi.trend}
                </Badge>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{kpi.desc}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        <Card className="md:col-span-4 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold">Distribuição por Plano</CardTitle>
            <CardDescription className="text-gray-500 font-medium">Volume de assinantes por nível tecnológico.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {Object.entries(financeStats?.planDistribution || {}).map(([plan, count]) => (
              <div key={plan} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-lg px-2 py-0.5 text-[10px] border-white/10 bg-white/5 text-purple-400 font-bold uppercase">
                      {plan}
                    </Badge>
                    <span className="text-sm font-bold text-white">{count} Unidades</span>
                  </div>
                  <span className="text-xs font-bold text-gray-500">
                    {Math.round((count / (financeStats?.tenantsCount || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      plan === 'PRO' ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gradient-to-r from-blue-500 to-cyan-500"
                    )} 
                    style={{ width: `${(count / (financeStats?.tenantsCount || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold">Ledger de Transações</CardTitle>
            <CardDescription className="text-gray-500 font-medium">Logs recentes do gateway de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {financeStats?.recentTransactions.map((t) => (
                  <TableRow key={t.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="py-4 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">R$ {(t.amount || 0).toLocaleString('pt-BR')}</span>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Liquidado</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Badge className="bg-white/5 border-white/10 text-gray-400 text-[9px] uppercase font-bold">Success</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {financeStats?.recentTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-20 text-gray-500 italic">
                      Nenhuma transação registrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
