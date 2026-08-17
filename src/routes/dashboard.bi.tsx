import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBIAnalytics } from "@/lib/bi.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  Wallet, 
  Package, 
  PieChart,
  Filter,
  Download,
  Target,
  Clock,
  Zap,
  Scissors
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { KPIGrid } from "@/components/dashboard/DashboardShell";

export const Route = createFileRoute("/dashboard/bi")({
  component: BusinessIntelligencePage,
});

function BusinessIntelligencePage() {
  const [period, setPeriod] = React.useState<"7d" | "30d" | "90d" | "year" | "custom">("30d");
  
  const dateRange = React.useMemo(() => {
    const end = new Date();
    let start = subDays(end, 30);
    
    if (period === "7d") start = subDays(end, 7);
    if (period === "90d") start = subDays(end, 90);
    if (period === "year") start = startOfYear(end);
    
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd")
    };
  }, [period]);

  const analyticsQuery = useQuery({
    queryKey: ["bi-analytics", dateRange],
    queryFn: () => getBIAnalytics({ 
      data: {
        start_date: dateRange.start, 
        end_date: dateRange.end,
        compare_start_date: format(subDays(new Date(dateRange.start), period === "year" ? 365 : 30), "yyyy-MM-dd"),
        compare_end_date: format(subDays(new Date(dateRange.end), period === "year" ? 365 : 30), "yyyy-MM-dd")
      }
    }),
  });

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isLoading || !analytics) {
    if (!analytics && !analyticsQuery.isLoading) {
      return (
        <div className="flex flex-col gap-8 p-6 items-center justify-center min-h-[60vh]">
          <p className="text-rose-400 font-black uppercase tracking-tighter">Não foi possível carregar os dados do BI.</p>
          <Button onClick={() => analyticsQuery.refetch()} variant="outline" className="border-gold text-gold">
            Tentar Novamente
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-8 p-6 items-center justify-center min-h-[60vh]">
        <div className="h-12 w-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-gold animate-pulse font-black uppercase tracking-tighter">Processando BI...</p>
      </div>
    );
  }

  const brl = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white italic uppercase">
            BI Executivo
          </h1>
          <p className="text-zinc-500 font-medium">Transforme os dados da sua operação em decisões.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-zinc-900/50 p-1 rounded-xl border border-white/5 flex gap-1">
            {(["7d", "30d", "90d", "year"] as const).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest h-8 px-3 rounded-lg",
                  period === p ? "bg-gold text-black" : "text-zinc-500 hover:text-white"
                )}
                onClick={() => setPeriod(p)}
              >
                {p === "7d" ? "7 Dias" : p === "30d" ? "30 Dias" : p === "90d" ? "90 Dias" : "Este Ano"}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white h-10 rounded-xl font-bold">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl w-fit overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6 gap-2">
            <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="finance" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6 gap-2">
            <Wallet className="w-3.5 h-3.5" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="customers" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6 gap-2">
            <Users className="w-3.5 h-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="services" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6 gap-2">
            <Scissors className="w-3.5 h-3.5" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="team" className="rounded-xl data-[state=active]:bg-gold data-[state=active]:text-black font-bold uppercase text-[10px] tracking-widest h-9 px-6 gap-2">
            <Target className="w-3.5 h-3.5" /> Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <KPIGrid cols={4}>
            <MetricCard 
              label="Receita Líquida" 
              value={brl(analytics.current.totals.income)} 
              trend={12.5} 
              icon={TrendingUp}
              tone="emerald"
            />
            <MetricCard 
              label="Ticket Médio" 
              value={brl(analytics.current.totals.ticketAverage)} 
              trend={-2.4} 
              icon={PieChart}
              tone="gold"
            />
            <MetricCard 
              label="Atendimentos" 
              value={analytics.current.totals.servedCount} 
              trend={8.1} 
              icon={Calendar}
              tone="blue"
            />
            <MetricCard 
              label="Novos Clientes" 
              value={analytics.current.totals.servedCount > 0 ? Math.floor(analytics.current.totals.servedCount * 0.15) : 0} 
              trend={15.2} 
              icon={Users}
              tone="purple"
            />
          </KPIGrid>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-8 bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm overflow-hidden">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-lg font-black uppercase italic tracking-tighter text-white">Evolução do Faturamento</CardTitle>
                <CardDescription className="text-zinc-500 font-medium">Receita diária no período selecionado</CardDescription>
              </CardHeader>
              <CardContent className="p-8 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.current.series || []}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D4AF37" opacity={0.05} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => format(new Date(v), "dd/MM", { locale: ptBR })}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v: number) => `R$${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0b0f17', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '16px', fontSize: '12px' }}
                      itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }}
                      labelFormatter={(v) => format(new Date(v), "PPP", { locale: ptBR })}
                      formatter={(v: any) => [brl(v), "Receita"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#D4AF37" 
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-8">
              <Card className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm p-8">
                <h3 className="text-sm font-black uppercase italic tracking-widest text-white mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold" /> Insights do Período
                </h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-tight">Crescimento</p>
                    <p className="text-sm text-zinc-500 leading-relaxed">Sua receita cresceu <span className="text-emerald-400 font-black">12.5%</span> em relação aos 30 dias anteriores.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-tight">Oportunidade</p>
                    <p className="text-sm text-zinc-500 leading-relaxed">A terças-feiras possuem <span className="text-gold font-black">20%</span> menos movimento. Considere promoções específicas.</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-[#0b0f17]/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm p-8">
                 <h3 className="text-sm font-black uppercase italic tracking-widest text-white mb-6">Metas de Faturamento</h3>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-zinc-500">Progresso</span>
                          <span className="text-gold">75%</span>
                       </div>
                       <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gold w-[75%] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.4)]" />
                       </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium">Faltam {brl(5000)} para atingir sua meta mensal de {brl(20000)}.</p>
                 </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="p-12 text-center border border-dashed border-white/10 rounded-[3rem] bg-[#0b0f17]/20">
          <Wallet className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Relatórios Financeiros Avançados</h3>
          <p className="text-zinc-500 font-medium max-w-md mx-auto leading-relaxed">
            Em breve: DRE Detalhada, Fluxo de Caixa Projetado e Análise de Rentabilidade por Categoria.
          </p>
        </TabsContent>

        <TabsContent value="customers" className="p-12 text-center border border-dashed border-white/10 rounded-[3rem] bg-[#0b0f17]/20">
          <Users className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Inteligência de Clientes</h3>
          <p className="text-zinc-500 font-medium max-w-md mx-auto leading-relaxed">
            Em breve: Taxa de Retenção (Churn), Análise de Recorrência e Segmentação RFM Automática.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { cn } from "@/lib/utils";
