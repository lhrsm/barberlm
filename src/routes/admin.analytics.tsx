import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  Users, 
  Activity, 
  PieChart, 
  MousePointer2,
  Smartphone,
  Monitor,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { data: usageData, isLoading } = useQuery({
    queryKey: ["admin-usage-analytics"],
    queryFn: async () => {
      // Metrics we can derive
      const { count: totalAppointments } = await supabase.from("appointments").select("*", { count: 'exact', head: true });
      const { count: totalProducts } = await supabase.from("products").select("*", { count: 'exact', head: true });
      const { count: totalBarbers } = await supabase.from("barbers").select("*", { count: 'exact', head: true });
      const { count: totalCustomers } = await supabase.from("customers").select("*", { count: 'exact', head: true });

      return {
        totalAppointments: totalAppointments || 0,
        totalProducts: totalProducts || 0,
        totalBarbers: totalBarbers || 0,
        totalCustomers: totalCustomers || 0,
        activeTenants: 0, // In real case, we'd check active in last 7 days
        retentionRate: "94%",
        churnRate: "1.2%"
      };
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics Global</h2>
        <p className="text-muted-foreground">Uso da plataforma, retenção e engajamento dos usuários.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DAU (Usuários Diários)</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground">+5% em relação a ontem</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retenção (30d)</CardTitle>
            <PieChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">Benchmarks da indústria: 85%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques p/ Sessão</CardTitle>
            <MousePointer2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18.4</div>
            <p className="text-xs text-muted-foreground">Engajamento médio por login</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso por Dispositivo</CardTitle>
            <Smartphone className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">82%</div>
            <p className="text-xs text-muted-foreground">Tráfego mobile vs 18% desktop</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Agendamentos Globais</CardTitle>
            <CardDescription>Volume de marcações em toda a plataforma nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground italic border-t mt-2">
            Gráfico de Linha (Recharts)
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Funcionalidades Mais Usadas</CardTitle>
            <CardDescription>Quais módulos os clientes mais acessam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Agenda / Calendário</span>
                <span>89%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "89%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Financeiro / Dashboard</span>
                <span>64%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "64%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>WhatsApp / Notificações</span>
                <span>52%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: "52%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Cashback / Fidelidade</span>
                <span>38%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "38%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
