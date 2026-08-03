import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  Database, 
  ShieldCheck, 
  Zap, 
  History, 
  AlertTriangle, 
  BarChart3, 
  LineChart, 
  Clock, 
  CheckCircle2, 
  Terminal,
  Search,
  RefreshCw,
  Server
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  PremiumTabs, 
  PremiumTabsList, 
  PremiumTabsBody, 
  PremiumTabsContent 
} from "@/components/ui/premium-tabs";
import { getSystemHealth, getScalabilityMetrics } from "@/lib/scalability.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/observability")({
  component: ObservabilityCenterPage,
});

function ObservabilityCenterPage() {
  const { data: health, isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => getSystemHealth(),
    refetchInterval: 30000 // 30s
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['scalability-metrics'],
    queryFn: () => getScalabilityMetrics()
  });

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center shadow-lg shadow-indigo-500/5">
            <Activity className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Observabilidade</h1>
            <p className="text-zinc-500 font-medium text-sm mt-1 uppercase tracking-tight">Monitoramento de Escalabilidade e Resiliência Enterprise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={() => refetchHealth()} className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white gap-2 uppercase font-black italic tracking-widest text-[10px]">
             <RefreshCw size={14} className={loadingHealth ? "animate-spin" : ""} /> Atualizar Agora
           </Button>
           <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black uppercase tracking-tighter italic">SaaS Operational</Badge>
        </div>
      </div>

      {/* Main Grid: Health & Real-time Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0b0f17] border-zinc-800 shadow-2xl overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white font-black italic uppercase tracking-tight">Saúde do Ecossistema</CardTitle>
                <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Status dos serviços fundamentais em tempo real</CardDescription>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-black uppercase text-[10px] italic">99.98% Uptime</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HealthStatusItem icon={Database} label="PostgreSQL" status={health?.services?.database === 'healthy' ? 'success' : 'error'} />
              <HealthStatusItem icon={ShieldCheck} label="Auth" status="success" />
              <HealthStatusItem icon={Zap} label="Realtime" status="success" />
              <HealthStatusItem icon={Server} label="Edge Fns" status="success" />
            </div>

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Latência Global do Banco</span>
                <span className={cn("text-xs font-black italic", (health?.metrics?.db_latency_ms || 0) > 200 ? "text-amber-400" : "text-emerald-400")}>
                  {health?.metrics?.db_latency_ms || 0}ms
                </span>
              </div>
              <Progress value={Math.min((health?.metrics?.db_latency_ms || 0) / 5, 100)} className="h-1.5 bg-zinc-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-zinc-800 shadow-2xl flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-white font-black italic uppercase tracking-tight text-lg">Alertas de Performance</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {[
              { id: 1, title: "Lentidão Detectada", type: "warning", time: "2m atrás", service: "Database" },
              { id: 2, title: "Fila de Automação", type: "info", time: "15m atrás", service: "Queue" }
            ].map(alert => (
              <div key={alert.id} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-start gap-3 hover:border-indigo-500/30 transition-all cursor-pointer group">
                <div className={cn("p-1.5 rounded-lg mt-0.5", alert.type === 'warning' ? "bg-amber-500/10" : "bg-indigo-500/10")}>
                  <AlertTriangle size={14} className={alert.type === 'warning' ? "text-amber-500" : "text-indigo-400"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white uppercase italic group-hover:text-indigo-400 transition-colors">{alert.title}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5 tracking-tighter">{alert.service} • {alert.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <PremiumTabs defaultValue="overview">
        <PremiumTabsList 
          tabs={[
            { value: "overview", label: "Overview", icon: BarChart3 },
            { value: "queues", label: "Filas & Jobs", icon: History },
            { value: "database", label: "Performance DB", icon: Database },
            { value: "logs", label: "Live Logs", icon: Terminal },
            { value: "flags", label: "Rollout & Flags", icon: Zap },
          ]}
        />
        <PremiumTabsBody>
          <PremiumTabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricStatCard title="Tenants Ativos" value={metrics?.active_tenants || 0} unit="unidades" icon={Server} />
              <MetricStatCard title="Agendamentos" value={metrics?.total_appointments || 0} unit="histórico" icon={Clock} />
              <MetricStatCard title="Taxa de Erro" value={`${(((metrics?.error_rate || 0)) * 100).toFixed(2)}%`} unit="avg" icon={AlertTriangle} isWarning={(metrics?.error_rate || 0) > 0.05} />
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="queues">
            <Card className="bg-[#0b0f17] border-zinc-800">
               <CardHeader>
                 <CardTitle className="text-white font-black italic uppercase tracking-tight">Status da Fila de Processamento</CardTitle>
                 <CardDescription className="text-zinc-500 font-bold uppercase text-[10px]">Fairness e Resiliência de Automações</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Pendentes</p>
                      <p className="text-3xl font-black text-white italic">{metrics?.queue_status?.pending || 0}</p>
                    </div>
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Falhados (Retry)</p>
                      <p className="text-3xl font-black text-amber-500 italic">{metrics?.queue_status?.failed || 0}</p>
                    </div>
                    <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Dead-Letter</p>
                      <p className="text-3xl font-black text-rose-500 italic">{metrics?.queue_status?.dead_letter || 0}</p>
                    </div>
                 </div>
               </CardContent>
            </Card>
          </PremiumTabsContent>
          
          <PremiumTabsContent value="logs">
            <div className="p-4 bg-black rounded-2xl border border-zinc-800 font-mono text-xs text-zinc-400 space-y-2 overflow-auto max-h-[400px]">
              <div className="flex items-center gap-2"><span className="text-indigo-400">[INFO]</span> <span className="text-zinc-600">2026-08-03T22:45:01Z</span> Trace: system_health_check - Success (12ms)</div>
              <div className="flex items-center gap-2"><span className="text-emerald-400">[SUCCESS]</span> <span className="text-zinc-600">2026-08-03T22:44:55Z</span> Automation enqueued for Tenant BX-124</div>
              <div className="flex items-center gap-2"><span className="text-amber-400">[WARN]</span> <span className="text-zinc-600">2026-08-03T22:44:30Z</span> Slow query detected: select * from appointments where tenant_id = ...</div>
              <div className="flex items-center gap-2 animate-pulse"><span className="text-zinc-500">_ Listening for live logs...</span></div>
            </div>
          </PremiumTabsContent>
        </PremiumTabsBody>
      </PremiumTabs>
    </div>
  );
}

function HealthStatusItem({ icon: Icon, label, status }: any) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-900 transition-colors">
      <div className={cn(
        "h-10 w-10 rounded-xl border grid place-items-center shadow-lg",
        status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5"
      )}>
        <Icon size={20} />
      </div>
      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">{label}</span>
      <Badge className={cn("text-[8px] uppercase font-black italic tracking-widest", status === 'success' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
        {status === 'success' ? 'ONLINE' : 'ERROR'}
      </Badge>
    </div>
  );
}

function MetricStatCard({ title, value, unit, icon: Icon, isWarning = false }: any) {
  return (
    <Card className="bg-[#0b0f17] border-zinc-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <Icon size={48} className={isWarning ? "text-rose-500" : "text-indigo-400"} />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-4xl font-black italic tracking-tighter", isWarning ? "text-rose-500" : "text-white")}>{value}</p>
        <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1 italic tracking-widest">{unit}</p>
      </CardContent>
    </Card>
  );
}
