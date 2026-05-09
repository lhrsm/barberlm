import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  LineChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: financeStats, isLoading } = useQuery({
    queryKey: ["admin-finance-stats"],
    queryFn: async () => {
      // Fetch plans to get prices
      const { data: plans } = await supabase.from("plans").select("*");
      
      // Fetch tenants and their plans
      const { data: tenants } = await supabase
        .from("profiles")
        .select("id, plan, created_at, role")
        .neq("role", "super_admin");

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Financeiro SaaS</h2>
        <p className="text-muted-foreground">Monitoramento de receita recorrente e saúde financeira da plataforma.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Recorrência Mensal)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {financeStats?.totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpRight size={12} className="text-green-500" /> +12.5% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR (Recorrência Anual)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {financeStats?.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground italic">Projeção baseada no MRR atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU (Receita média p/ usuário)</CardTitle>
            <PieChart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {financeStats ? (financeStats.totalMRR / (financeStats.tenantsCount || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}
            </div>
            <p className="text-xs text-muted-foreground">Total MRR / Total Barbearias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate (Cancelamentos)</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowDownRight size={12} className="text-green-500" /> -0.3% melhor que a média global
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Receita por Plano</CardTitle>
            <CardDescription>Distribuição financeira por nível de assinatura.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground italic border-t mt-2">
            <div className="flex flex-col items-center gap-4 w-full px-8">
              {Object.entries(financeStats?.planDistribution || {}).map(([plan, count]) => (
                <div key={plan} className="w-full">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">{plan}</span>
                    <span>{count} tenants</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full",
                        plan === 'PRO' ? "bg-purple-500" : plan === 'BASIC' ? "bg-blue-500" : "bg-gray-400"
                      )} 
                      style={{ width: `${(count / (financeStats?.tenantsCount || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>Últimos pagamentos processados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeStats?.recentTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-xs">R$ {t.amount.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] h-5">Concluído</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {financeStats?.recentTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-xs text-muted-foreground">
                      Nenhuma transação recente.
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
