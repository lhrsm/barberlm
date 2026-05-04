import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Users, 
  Scissors, 
  Calendar, 
  CircleDollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";

export const Route = createFileRoute("/")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    daily: {
      appointments: 0,
      revenue: 0,
      newCustomers: 0
    },
    monthly: {
      appointments: 0,
      revenue: 0,
      newCustomers: 0
    },
    total: {
      customers: 0,
      services: 0
    }
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  async function fetchStats() {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [
      dailyApp, 
      monthlyApp, 
      dailyTrans, 
      monthlyTrans,
      dailyCust,
      monthlyCust,
      totalCust,
      totalServ
    ] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true }).gte("start_time", todayStart).lte("start_time", todayEnd),
      supabase.from("appointments").select("*", { count: "exact", head: true }).gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("transactions").select("amount").eq("type", "income").gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("transactions").select("amount").eq("type", "income").gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("services").select("*", { count: "exact", head: true })
    ]);

    const dailyRevenue = dailyTrans.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
    const monthlyRevenue = monthlyTrans.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    setStats({
      daily: {
        appointments: dailyApp.count || 0,
        revenue: dailyRevenue,
        newCustomers: dailyCust.count || 0
      },
      monthly: {
        appointments: monthlyApp.count || 0,
        revenue: monthlyRevenue,
        newCustomers: monthlyCust.count || 0
      },
      total: {
        customers: totalCust.count || 0,
        services: totalServ.count || 0
      }
    });
  }

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
          <p className="text-muted-foreground">Visão geral da sua barbearia hoje.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.customers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serviços Ativos</CardTitle>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.services}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.appointments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.revenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button onClick={() => navigate({ to: "/calendar" })} className="gap-2">
                <Calendar size={18} /> Novo Agendamento
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/customers" })} className="gap-2">
                <Users size={18} /> Novo Cliente
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Status da Conta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp size={20} />
                <span className="font-medium">Sistema Ativo</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Seu plano Free está ativo. Você pode cadastrar até 50 clientes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
