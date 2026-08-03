import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  BarChart3, 
  CircleDollarSign, 
  CalendarClock, 
  Users, 
  Scissors, 
  Package, 
  Gift, 
  Crown, 
  Megaphone,
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  CheckCircle2,
  CalendarDays,
  Target
} from "lucide-react";
import { useIntelligenceData } from "@/components/intelligence/useIntelligenceData";
import { buildIntelligence, brl } from "@/components/intelligence/engine";
import { erpPeriodRange, previousRange, useErpFinance, type ErpPeriod } from "@/components/finances/erp/useErpFinance";
import { computeTotals, computeDre, computeKpis, variation, pct } from "@/components/finances/erp/engine";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/kpis")({
  component: KpisCentralPage,
  head: () => ({
    meta: [
      { title: "Central de KPIs | Barbex" },
      { name: "description", content: "Painel analítico centralizado do Barbex." },
    ],
  }),
});

const PERIODS: { value: ErpPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
];

function KpisCentralPage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { role, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ErpPeriod>("month");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, authLoading, navigate]);

  // Data Sources
  const range = useMemo(() => erpPeriodRange(period), [period]);
  const prevRange = useMemo(() => previousRange(range), [range]);
  
  const erpData = useErpFinance(tenantId ?? null, range);
  const prevErpData = useErpFinance(tenantId ?? null, prevRange, !!prevRange.start);
  
  const intelData = useIntelligenceData(tenantId ?? null);
  const iq = useMemo(() => buildIntelligence(intelData.data), [intelData.data]);

  // Derived Totals (Using existing engines for consistency)
  const totals = useMemo(() => computeTotals(erpData), [erpData]);
  const prevTotals = useMemo(() => (prevRange.start ? computeTotals(prevErpData) : null), [prevErpData, prevRange.start]);
  const dre = useMemo(() => computeDre(totals), [totals]);
  const prevDre = useMemo(() => (prevTotals ? computeDre(prevTotals) : null), [prevTotals]);

  const barbersCount = (erpData as any).barbers?.filter((b: any) => b.active).length || 0;
  const kpiMetrics = useMemo(() => computeKpis(totals, { appointments: erpData.appointments, barbersCount }), [totals, erpData.appointments, barbersCount]);

  const isLoadingData = erpData.isLoading || intelData.isLoading || tenantLoading || authLoading;

  if (isLoadingData) {
    return (
      <AppLayout>
        <div className="p-8 space-y-4">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="gold" className="px-3 py-1 uppercase tracking-widest font-black text-[9px]">
                <BarChart3 className="h-3 w-3 mr-1.5" />
                Performance Engine
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tightest italic text-white uppercase">
              Central de <span className="text-gradient-gold">KPIs</span>
            </h1>
            <p className="text-muted-foreground font-bold text-sm">
              Indicadores consolidados e métricas estratégicas da sua barbearia.
            </p>
          </div>

          <div className="flex items-center gap-2">
             <Button variant="outline" className="rounded-2xl border-gold/20 bg-gold/5 text-gold font-bold">
               <Download className="h-4 w-4 mr-2" /> Exportar
             </Button>
             <Button 
               variant="gold" 
               className="rounded-2xl font-black px-6"
               onClick={() => {
                 erpData.refetch();
                 intelData.refetch();
               }}
             >
               <RefreshCcw className={cn("h-4 w-4 mr-2", (erpData.isLoading || intelData.isFetching) && "animate-spin")} />
               Sincronizar
             </Button>
          </div>
        </header>

        {/* Global Filters */}
        <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40 backdrop-blur-md p-2">
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "gold" : "ghost"}
                size="sm"
                className={cn(
                  "rounded-xl px-6 font-bold transition-all",
                  period === p.value ? "shadow-gold/20" : "text-muted-foreground hover:bg-white/5"
                )}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2 px-2">
               <Filter className="h-4 w-4 text-muted-foreground" />
               <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">{range.label}</span>
            </div>
          </div>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-[2rem] border border-gold/15 bg-surface-sunken/60 p-1.5">
            {[
              { id: "overview", label: "Visão Geral", icon: TrendingUp },
              { id: "finance", label: "Financeiro", icon: CircleDollarSign },
              { id: "agenda", label: "Agenda", icon: CalendarClock },
              { id: "customers", label: "Clientes", icon: Users },
              { id: "barbers", label: "Profissionais", icon: Scissors },
              { id: "products", label: "Produtos", icon: Package },
              { id: "loyalty", label: "Fidelização", icon: Gift },
              { id: "subscriptions", label: "Assinaturas", icon: Crown },
              { id: "marketing", label: "Marketing", icon: Megaphone },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-gold/15 data-[state=active]:text-gold transition-all"
              >
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                label="Receita Bruta" 
                value={brl(totals.income)} 
                icon={CircleDollarSign}
                variation={variation(totals.income, prevTotals?.income || 0)}
                hint="Total de entradas brutas registradas no período."
                variant="gold"
              />
              <KPICard 
                label="Agendamentos" 
                value={totals.servedCount} 
                icon={CalendarClock}
                variation={variation(totals.servedCount, prevTotals?.servedCount || 0)}
                hint="Total de atendimentos concluídos."
              />
              <KPICard 
                label="Ticket Médio" 
                value={brl(totals.ticketAverage)} 
                icon={BarChart3}
                variation={variation(totals.ticketAverage, prevTotals?.ticketAverage || 0)}
                hint="Receita de serviços dividida pelo total de atendimentos."
              />
              <KPICard 
                label="Lucro Líquido" 
                value={brl(dre.netProfit)} 
                icon={TrendingUp}
                variation={prevDre ? variation(dre.netProfit, prevDre.netProfit) : null}
                hint="Receita líquida menos custos, despesas e benefícios concedidos."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <BarChart3 className="h-5 w-5 text-gold" />
                     Distribuição de Receita
                   </CardTitle>
                   <CardDescription>Principais fontes de faturamento mapeadas</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <ProgressBar label="Serviços" value={totals.servicesRevenue} total={totals.income || 1} color="bg-gold" />
                    <ProgressBar label="Produtos" value={totals.productsRevenue} total={totals.income || 1} color="bg-emerald-500" />
                    <ProgressBar label="Assinaturas" value={totals.subscriptionsRevenue} total={totals.income || 1} color="bg-purple-500" />
                 </CardContent>
               </Card>

               <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <Target className="h-5 w-5 text-gold" />
                     Métricas de Eficiência
                   </CardTitle>
                   <CardDescription>KPIs de produtividade e conversão</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="grid grid-cols-2 gap-4">
                      {kpiMetrics.map((kpi) => (
                        <div key={kpi.key} className="p-4 rounded-3xl bg-white/5 border border-white/5">
                           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.label}</p>
                           <p className="text-xl font-black mt-1 text-white">{kpi.value}</p>
                           <p className="text-[10px] text-muted-foreground font-bold mt-1 line-clamp-1">{kpi.hint}</p>
                        </div>
                      ))}
                   </div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="finance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard label="Receita Líquida" value={brl(dre.netRevenue)} icon={TrendingUp} hint="Receita bruta menos descontos." />
              <KPICard label="Custos (Comissões)" value={brl(totals.commissionsTotal)} icon={Scissors} hint="Total de comissões geradas (pagas e pendentes)." tone="negative" />
              <KPICard label="Despesas Operacionais" value={brl(totals.expense)} icon={TrendingDown} hint="Gastos fixos e variáveis registrados." tone="negative" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40 lg:col-span-2">
                <CardHeader>
                  <CardTitle>DRE Simplificada</CardTitle>
                  <CardDescription>Demonstrativo de Resultados do Exercício ({range.label})</CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      <DRERow label="(+) Receita Bruta" value={dre.grossRevenue} />
                      <DRERow label="(-) Descontos" value={dre.discounts} tone="negative" />
                      <DRERow label="(=) Receita Líquida" value={dre.netRevenue} isBold />
                      <DRERow label="(-) Comissões (Custos)" value={dre.costs} tone="negative" />
                      <DRERow label="(-) Despesas Administrativas" value={dre.expenses} tone="negative" />
                      <DRERow label="(=) Lucro Operacional" value={dre.operatingProfit} isBold />
                      <DRERow label="(-) Benefícios (Cashback Concedido)" value={dre.cashbackGranted} tone="negative" />
                      <tr className="h-12 border-t-2 border-gold/30">
                        <td className="font-black text-gold uppercase tracking-widest">(=) Lucro Líquido</td>
                        <td className="text-right font-black text-gold text-lg">{brl(dre.netProfit)}</td>
                      </tr>
                      <tr className="h-10">
                        <td className="text-xs font-bold text-muted-foreground uppercase">Margem Líquida</td>
                        <td className="text-right font-black text-white">{pct(dre.margin)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="space-y-6">
                 <MiniKPICard label="Receita por Atendimento" value={kpiMetrics.find(k => k.key === 'revenue-appt')?.value || '—'} />
                 <MiniKPICard label="Receita por Hora" value={kpiMetrics.find(k => k.key === 'revenue-hour')?.value || '—'} />
                 <MiniKPICard label="Participação de Produtos" value={kpiMetrics.find(k => k.key === 'products-share')?.value || '—'} />
                 <MiniKPICard label="Impacto de Comissões" value={kpiMetrics.find(k => k.key === 'commission-share')?.value || '—'} />
              </div>
            </div>
          </TabsContent>

          {/* Placeholder tabs for future deep integration if needed, currently showing "No Data" logic */}
          {["agenda", "customers", "barbers", "products", "loyalty", "subscriptions", "marketing"].map((tabId) => (
             <TabsContent key={tabId} value={tabId} className="animate-in fade-in duration-500">
               <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40 p-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                     <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 italic">Aprofundamento de {tabId}</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Os KPIs principais desta categoria já estão consolidados na Visão Geral. O detalhamento granular será expandido em breve utilizando os motores de Inteligência e Marketing.
                  </p>
                  <Button variant="outline" className="mt-6 rounded-2xl border-gold/20" asChild>
                    <Link to="/intelligence">Ver na Inteligência Comercial</Link>
                  </Button>
               </Card>
             </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Sub-components for KPIs
function KPICard({ label, value, icon: Icon, variation, hint, variant = 'default', tone = 'positive' }: any) {
  const isPositive = variation == null || variation >= 0;
  
  return (
    <TooltipProvider>
      <Card className={cn(
        "relative group overflow-hidden shine rounded-[2rem] border-hairline transition-all duration-500",
        "hover:-translate-y-1 hover:shadow-gold/10",
        variant === 'gold' ? "bg-gold/[0.03] border-gold/20" : "bg-surface-sunken/40"
      )}>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
              variant === 'gold' ? "bg-gold/20 text-gold" : "bg-white/5 text-muted-foreground"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            
            {variation !== undefined && variation !== null && (
              <Badge 
                variant={isPositive ? "success" : "destructive"} 
                className={cn("px-2 py-0.5 font-black text-[9px] uppercase tracking-tighter", !isPositive && tone === 'negative' ? "bg-rose-500/10 text-rose-500" : "")}
              >
                {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {variation === 100 ? "New" : `${variation.toFixed(1)}%`}
              </Badge>
            )}

            {hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="absolute top-6 right-6 p-1 text-muted-foreground/40 hover:text-gold transition-colors">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-surface-overlay text-[10px] font-bold border-gold/20">{hint}</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">{label}</p>
            <h3 className="text-3xl font-black text-white tracking-tightest">{value}</h3>
          </div>
        </CardContent>
        {variant === 'gold' && (
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gold/5 blur-3xl rounded-full" />
        )}
      </Card>
    </TooltipProvider>
  );
}

function MiniKPICard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-[2rem] border border-hairline bg-surface-sunken/40 hover:border-gold/30 transition-colors group">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-gold transition-colors">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function DRERow({ label, value, tone = 'positive', isBold = false }: any) {
  return (
    <tr className={cn("h-11", isBold && "bg-white/[0.02]")}>
      <td className={cn("text-xs font-bold uppercase tracking-tight", isBold ? "text-white" : "text-muted-foreground")}>{label}</td>
      <td className={cn(
        "text-right font-black tabular-nums",
        tone === 'negative' ? "text-rose-400" : isBold ? "text-white text-base" : "text-emerald-400"
      )}>
        {brl(value)}
      </td>
    </tr>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-black uppercase tracking-widest text-white/70">{label}</span>
        <span className="text-xs font-black text-white">{brl(value)} <span className="text-muted-foreground/60 ml-1">({percentage.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div 
          className={cn("h-full transition-all duration-1000", color)} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}
