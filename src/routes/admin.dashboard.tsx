import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  Plus,
  Rocket,
  Download,
  Filter,
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  Activity,
  LifeBuoy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AdminChartsTab } from "@/components/admin/AdminChartsTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

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
      
      // Fetch ALL Appointments for stats
      const { data: appointments } = await supabase
        .from("appointments")
        .select("final_amount, cashback_earned, credit_used, status, created_at");

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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
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
    { label: "Total Barbearias", value: stats?.totalTenants ?? 0, icon: Building2, color: "text-blue-400", glow: "shadow-blue-500/20", trend: "+3", isPositive: true },
    { label: "Assinaturas Ativas", value: stats?.activeSubs ?? 0, icon: CreditCard, color: "text-purple-400", glow: "shadow-purple-500/20", trend: "+12%", isPositive: true },
    { label: "MRR Estimado", value: `R$ ${(stats?.mrr ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-emerald-400", glow: "shadow-emerald-500/20", trend: "+R$ 450", isPositive: true },
    { label: "Total Transacionado", value: `R$ ${(stats?.totalTransacted ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CircleDollarSign, color: "text-amber-400", glow: "shadow-amber-500/20", trend: "+18%", isPositive: true },
    { label: "Cashback Emitido", value: `R$ ${(stats?.totalCashback ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Award, color: "text-pink-400", glow: "shadow-pink-500/20", trend: "+5%", isPositive: true },
    { label: "Créditos Ativos", value: `R$ ${(stats?.totalCredits ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Wallet, color: "text-orange-400", glow: "shadow-orange-500/20", trend: "-2%", isPositive: false },
    { label: "Novos Assinantes", value: "8", icon: Rocket, color: "text-cyan-400", glow: "shadow-cyan-500/20", trend: "+25%", isPositive: true },
    { label: "Ticket Médio", value: "R$ 45,00", icon: Target, color: "text-indigo-400", glow: "shadow-indigo-500/20", trend: "+3%", isPositive: true },
  ];

  return (
    <div className="space-y-12 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-10 pb-6">
        <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-600 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-purple-500" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-purple-400">Visão Geral da Plataforma</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none italic bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                SAAS PERFORMANCE
              </h1>
              <p className="text-lg text-gray-400 max-w-xl font-medium">
                Monitoramento global em tempo real da infraestrutura Barbex.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2 h-12 px-6 rounded-2xl backdrop-blur-md">
                <Filter className="w-4 h-4" /> Filtros Avançados
              </Button>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] text-white gap-2 h-12 px-6 rounded-2xl border-none transition-all duration-300">
                <RefreshCw className="w-4 h-4" /> Novo Snapshot
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-3xl bg-white/5" />
          ))
        ) : (
          statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <Card className={cn(
                "glass group transition-all duration-500 rounded-[2rem] overflow-hidden relative h-full flex flex-col justify-between shadow-2xl shadow-black/40 border-2",
                stat.color.replace('text-', 'border-').replace('400', '500/30'),
                "hover:" + stat.color.replace('text-', 'border-').replace('400', '500/60')
              )}>
                {/* Decorative background glow */}
                <div className={cn("absolute -top-10 -right-10 w-32 h-32 blur-[80px] opacity-20 pointer-events-none rounded-full group-hover:opacity-40 transition-opacity", stat.glow)} />
                
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6 px-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 group-hover:text-white transition-colors">
                      {stat.label}
                    </span>
                    <div className={cn("h-0.5 w-6 opacity-40 group-hover:w-10 transition-all duration-500", stat.color.replace('text-', 'bg-'))} />
                  </div>
                  <div className={cn("p-3 rounded-2xl bg-white/10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl border border-white/10", stat.color)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6 pt-2">
                  <div className="flex flex-col gap-1">
                    <div className="text-4xl font-black tracking-tighter mb-2 text-white group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all">
                      {stat.value}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] border-none font-black tracking-wider shadow-lg",
                          stat.isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}>
                          <div className="flex items-center gap-1">
                            {stat.isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {stat.trend}
                          </div>
                        </Badge>
                        <span className="text-[9px] text-white/50 font-bold uppercase tracking-tighter">Snapshot Mensal</span>
                      </div>
                      
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-colors">
                        <TrendingUp size={12} className={cn("transition-transform group-hover:scale-110", stat.color)} />
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                {/* Bottom line accent */}
                <div className={cn("absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full transition-all duration-700", stat.color.replace('text-', 'bg-'))} />
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Analytics Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Distribuição de Infraestrutura</h2>
          </div>
          <Button variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-2">
            Exportar Relatório <Download className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-1 glass rounded-[2.5rem] border-white/5">
           <AdminChartsTab />
        </div>
      </motion.div>

      {/* Recent Activity Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="grid gap-6 md:grid-cols-2"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-xl">
              <Activity className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Atividade Recente</h2>
          </div>
          
          <Card className="glass border-white/5 rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {stats?.totalTenants === 0 ? (
                   <div className="p-8 text-center text-gray-500 italic">Nenhuma atividade registrada.</div>
                ) : (
                  [
                    { title: "Nova Barbearia Cadastrada", time: "Há 5 minutos", type: "tenant", icon: Building2, color: "text-blue-400" },
                    { title: "Assinatura Plano Pro Aprovada", time: "Há 12 minutos", type: "payment", icon: Zap, color: "text-purple-400" },
                    { title: "Ticket de Suporte Resolvido", time: "Há 45 minutos", type: "support", icon: LifeBuoy, color: "text-emerald-400" },
                    { title: "Novo Barbeiro Adicionado", time: "Há 1 hora", type: "staff", icon: Users, color: "text-amber-400" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer group">
                      <div className={cn("p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform", item.color)}>
                        <item.icon size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{item.title}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-bold">{item.time}</p>
                      </div>
                      <ArrowUpRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-white/5 text-center">
                <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-white">
                  Ver log completo do sistema
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-xl">
              <Target className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Metas e Performance</h2>
          </div>
          
          <Card className="glass border-white/5 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-gray-400">Meta de Novos Tenants</span>
                <span className="text-purple-400">85%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[85%] bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                <span className="text-gray-400">Taxa de Conversão Pro</span>
                <span className="text-cyan-400">62%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[62%] bg-gradient-to-r from-cyan-600 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Churn Rate</p>
                <p className="text-xl font-black text-rose-400">1.2%</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">LTV Médio</p>
                <p className="text-xl font-black text-emerald-400">R$ 450</p>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
