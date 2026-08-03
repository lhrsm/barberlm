import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOperationalIntelligence } from "@/components/operational-intelligence/useOperationalIntelligence";
import { 
  OperationalInsight, 
  InsightPriority, 
  InsightCategory 
} from "@/components/operational-intelligence/engine";
import { 
  Radar, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  Info, 
  CheckCircle2, 
  Clock, 
  Filter, 
  ArrowRight,
  RefreshCcw,
  Calendar,
  Users,
  Package,
  Wallet,
  Settings,
  XCircle,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/operational-insights")({
  component: OperationalIntelligencePage,
  head: () => ({
    meta: [
      { title: "Inteligência Operacional | Barbex" },
      { name: "description", content: "Alertas e recomendações operacionais para sua barbearia." },
    ],
  }),
});

const CATEGORY_ICONS: Record<InsightCategory, any> = {
  Operation: Settings,
  Agenda: Calendar,
  Customers: Users,
  Finance: Wallet,
  Barbers: Users,
  Products: Package,
  Inventory: Package,
  Subscriptions: Settings,
  Loyalty: Settings,
  Marketing: Settings,
  Support: Settings,
  Integration: Settings,
};

function OperationalIntelligencePage() {
  const { insights, isLoading, interact, refetch, isFetching } = useOperationalIntelligence();
  const [filterPriority, setFilterPriority] = useState<InsightPriority | "all">("all");

  const filteredInsights = useMemo(() => {
    if (filterPriority === "all") return insights;
    return insights.filter(i => i.priority === filterPriority);
  }, [insights, filterPriority]);

  const criticalCount = insights.filter(i => i.priority === 'critical').length;
  const highCount = insights.filter(i => i.priority === 'high').length;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="gold" className="px-3 py-1 uppercase tracking-widest font-black text-[9px]">
                <Radar className="h-3 w-3 mr-1.5" />
                Operational Radar
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tightest italic text-white uppercase">
              Inteligência <span className="text-gradient-gold">Operacional</span>
            </h1>
            <p className="text-muted-foreground font-bold text-sm">
              Diagnósticos e prioridades geradas a partir da realidade da sua operação.
            </p>
          </div>

          <div className="flex items-center gap-2">
             <Button 
               variant="gold" 
               className="rounded-2xl font-black px-6 shadow-gold/20"
               onClick={() => refetch()}
             >
               <RefreshCcw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
               Analisar Agora
             </Button>
          </div>
        </header>

        {/* Radar Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40 overflow-hidden relative group">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Alertas Críticos</p>
              <h3 className={cn("text-4xl font-black tracking-tighter", criticalCount > 0 ? "text-rose-500" : "text-white")}>
                {criticalCount}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-bold">Ações imediatas recomendadas</p>
            </CardContent>
            {criticalCount > 0 && <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-500/10 blur-3xl rounded-full animate-pulse" />}
          </Card>
          
          <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Prioridade Alta</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">{highCount}</h3>
              <p className="text-xs text-muted-foreground mt-1 font-bold">Otimizações importantes</p>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/40">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Saúde Operacional</p>
              <div className="flex items-center gap-3">
                <h3 className="text-4xl font-black text-gold tracking-tighter">
                  {insights.length === 0 ? "100%" : `${Math.max(0, 100 - (criticalCount * 20) - (highCount * 10))}%`}
                </h3>
                <Badge className="bg-emerald-500/10 text-emerald-500 font-black text-[9px]">ESTÁVEL</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-bold">Baseado nos indicadores ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Lista */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gold" />
              <span className="text-xs font-black uppercase tracking-widest text-white">Filtrar por Prioridade:</span>
            </div>
            <div className="flex gap-2">
              {["all", "critical", "high", "medium", "low"].map((p) => (
                <Button
                  key={p}
                  variant={filterPriority === p ? "gold" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-xl px-4 text-[10px] font-black uppercase tracking-widest",
                    filterPriority === p ? "" : "text-muted-foreground"
                  )}
                  onClick={() => setFilterPriority(p as any)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-[2rem]" />
              ))
            ) : filteredInsights.length === 0 ? (
              <Card className="rounded-[2.5rem] border-hairline bg-surface-sunken/20 p-20 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 italic uppercase tracking-tightest">Tudo Sob Controle</h3>
                <p className="text-muted-foreground max-w-sm mx-auto font-bold text-sm">
                  Nenhum alerta operacional relevante foi identificado neste momento. Sua barbearia está operando dentro dos parâmetros normais.
                </p>
              </Card>
            ) : (
              filteredInsights.map((insight) => (
                <InsightCard 
                  key={insight.id} 
                  insight={insight} 
                  onAction={(status) => interact({ rule_key: insight.rule_key, entity_id: insight.entity_id, status })} 
                />
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InsightCard({ insight, onAction }: { insight: OperationalInsight; onAction: (status: string) => void }) {
  const Icon = CATEGORY_ICONS[insight.category] || Info;

  const priorityColors = {
    critical: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    medium: "bg-gold/10 text-gold border-gold/20",
    low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    info: "bg-white/5 text-white/70 border-white/10",
  };

  return (
    <Card className={cn(
      "rounded-[2rem] border-hairline bg-surface-sunken/40 overflow-hidden group transition-all duration-300 hover:border-gold/30",
      insight.priority === 'critical' && "border-rose-500/20"
    )}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Categoria/Icone Mobile-Optimized Side */}
          <div className={cn(
            "w-full md:w-20 p-4 md:p-0 flex md:flex-col items-center justify-center gap-2 border-b md:border-b-0 md:border-r border-white/5",
            insight.priority === 'critical' ? "bg-rose-500/5" : "bg-white/[0.02]"
          )}>
            <div className={cn("p-2 rounded-xl", insight.priority === 'critical' ? "bg-rose-500/20 text-rose-500" : "bg-gold/20 text-gold")}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter vertical-text text-muted-foreground md:rotate-180 md:[writing-mode:vertical-lr]">
              {insight.category}
            </span>
          </div>

          <div className="flex-1 p-6 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("px-2 py-0.5 font-black text-[9px] uppercase tracking-widest border", priorityColors[insight.priority])}>
                    {insight.priority}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(insight.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tightest uppercase italic">
                  {insight.title}
                </h3>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-surface-overlay border-gold/20">
                  <DropdownMenuItem className="text-xs font-bold" onClick={() => onAction('resolved')}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Marcar como Resolvido
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs font-bold" onClick={() => onAction('dismissed')}>
                    <XCircle className="h-3.5 w-3.5 mr-2 text-rose-500" /> Descartar Alerta
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs font-bold" onClick={() => onAction('snoozed')}>
                    <Clock className="h-3.5 w-3.5 mr-2 text-blue-500" /> Lembrar Amanhã
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-sm text-white/80 font-bold leading-relaxed">
              {insight.description}
            </p>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group-hover:border-gold/10 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1">
                <Info className="h-3 w-3" /> Evidência do Sistema
              </p>
              <p className="text-xs font-bold text-white italic">
                "{insight.evidence}"
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Ação Sugerida:</span>
                 <span className="text-xs font-black text-gold uppercase">{insight.suggested_action}</span>
              </div>
              <Button asChild size="sm" variant="gold" className="rounded-xl px-6 h-9 font-black shadow-gold/10">
                <Link to={insight.destination_route}>
                  Executar <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
