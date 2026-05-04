import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  CreditCard, 
  CircleDollarSign, 
  BarChart3, 
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/platform-admin")({
  component: PlatformAdminComponent,
});

function PlatformAdminComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    totalAppointments: 0,
    recentRegistrations: [] as any[],
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function checkAdminAndFetch() {
      if (loading) return;
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== 'admin') {
        toast.error("Acesso negado. Apenas administradores do sistema.");
        navigate({ to: "/dashboard" });
        return;
      }

      setIsAdmin(true);
      fetchPlatformStats();
    }

    checkAdminAndFetch();
  }, [user, loading, navigate]);

  async function fetchPlatformStats() {
    setFetching(true);
    try {
      // 1. Total Tenants
      const { count: tenantsCount } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true });

      // 2. Active Subscriptions (Basic, Intermediate, Pro)
      const { count: activeSubs } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .neq("plan", "free");

      // 3. Recent Registrations
      const { data: recent } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      // 4. Global Appointments (Total activity)
      const { count: appCount } = await supabase
        .from("appointments")
        .select("*", { count: 'exact', head: true });

      // 5. Total Revenue (Approximation based on transaction entries)
      const { data: incomeData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "income");
      
      const totalRevenue = incomeData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

      setStats({
        totalTenants: tenantsCount || 0,
        activeSubscriptions: activeSubs || 0,
        totalRevenue: totalRevenue,
        totalAppointments: appCount || 0,
        recentRegistrations: recent || [],
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados da plataforma.");
    } finally {
      setFetching(false);
    }
  }

  if (loading || !isAdmin || fetching) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin da Plataforma (SaaS)</h2>
          <p className="text-muted-foreground">Visão geral do crescimento e saúde do seu negócio.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Barbearias</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-muted-foreground">Cadastros na plataforma</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">Planos pagos ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Global</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total processado (vendas + serviços)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uso da Agenda</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">Agendamentos totais</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Últimos Cadastros</CardTitle>
              <CardDescription>Novas barbearias que entraram na plataforma recentemente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barbearia</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentRegistrations.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.business_name || "Sem nome"}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.plan === 'free' ? 'secondary' : 'default'}>
                          {tenant.plan || 'Free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Ferramentas de gerenciamento do SaaS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-primary/5">
                <ShieldCheck className="text-primary" size={24} />
                <div className="flex-1">
                  <p className="font-bold text-sm">Modo Master</p>
                  <p className="text-xs text-muted-foreground">Você tem permissão total sobre os dados.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                <BarChart3 className="text-blue-500" size={24} />
                <div className="flex-1">
                  <p className="font-bold text-sm">Exportar Relatórios</p>
                  <p className="text-xs text-muted-foreground">CSV de todos os clientes e faturamento.</p>
                </div>
                <ArrowUpRight size={16} className="text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                <Activity className="text-green-500" size={24} />
                <div className="flex-1">
                  <p className="font-bold text-sm">Status do Sistema</p>
                  <p className="text-xs text-muted-foreground">Monitoramento de infraestrutura.</p>
                </div>
                <ArrowUpRight size={16} className="text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
