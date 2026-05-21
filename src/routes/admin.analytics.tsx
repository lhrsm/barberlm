import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  PieChart, 
  MousePointer2,
  Smartphone,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminChartsTab } from "@/components/admin/AdminChartsTab";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">ANALYTICS GLOBAL</h2>
          <p className="text-gray-400 font-medium">Uso da plataforma, retenção e engajamento dos usuários.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">Visão Geral</TabsTrigger>
          <TabsTrigger value="charts" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">Performance</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">Engajamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "DAU (Ativos)", value: "142", icon: Activity, color: "text-emerald-400", trend: "+5%", desc: "vs ontem" },
              { label: "Retenção (30d)", value: "94%", icon: PieChart, color: "text-blue-400", trend: "Alta", desc: "estável" },
              { label: "Crescimento", value: "+12%", icon: TrendingUp, color: "text-purple-400", trend: "+3%", desc: "vs mês ant." },
              { label: "Plataforma", value: "82%", icon: Smartphone, color: "text-amber-400", trend: "Mobile", desc: "predominante" }
            ].map((kpi, i) => (
              <Card key={i} className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{kpi.label}</span>
                  <div className={cn("p-2 rounded-xl bg-white/5", kpi.color)}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tight mb-2 text-white">{kpi.value}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">{kpi.trend}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{kpi.desc}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
              <CardHeader className="bg-white/5 px-8 py-6">
                <CardTitle className="text-xl font-bold">Atividade por Módulo</CardTitle>
                <CardDescription className="text-gray-500 font-medium">Distribuição de acessos globais na plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {[
                  { label: "Agenda / Calendário", value: 89, color: "from-blue-500 to-cyan-500" },
                  { label: "Financeiro", value: 64, color: "from-emerald-500 to-teal-500" },
                  { label: "Configurações", value: 32, color: "from-amber-500 to-orange-500" }
                ].map((module) => (
                  <div key={module.label} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white uppercase tracking-tight">{module.label}</span>
                      <span className="text-xs font-black text-purple-400">{module.value}%</span>
                    </div>
                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000", module.color)} 
                        style={{ width: `${module.value}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
              <CardHeader className="bg-white/5 px-8 py-6">
                <CardTitle className="text-xl font-bold">Insights Estratégicos</CardTitle>
                <CardDescription className="text-gray-500 font-medium">Alertas e oportunidades do mês.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 flex flex-col gap-6">
                <div className="flex items-center gap-6 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="p-4 bg-purple-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white italic uppercase tracking-tighter">Recorde Histórico</p>
                    <p className="text-xs text-gray-500 font-medium">Agendamentos em 12/05 atingiram pico de carga.</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="p-4 bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                    <Activity className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white italic uppercase tracking-tighter">Uptime Crítico</p>
                    <p className="text-xs text-gray-500 font-medium">Disponibilidade de 99.98% nos clusters AWS.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-1 glass rounded-[2.5rem] border-white/5">
            <AdminChartsTab />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="glass border-white/5 rounded-[3rem] p-12 text-center overflow-hidden relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600 rounded-full blur-[160px] opacity-20" />
            <div className="relative z-10 space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/10 shadow-2xl">
                <MousePointer2 className="h-10 w-10 text-purple-400 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter text-white italic">HEATMAPS & FLOWS</h3>
                <p className="text-gray-400 font-medium max-w-sm mx-auto">Métricas detalhadas de cliques e fluxo de navegação inteligente.</p>
              </div>
              <Badge className="bg-purple-600 text-white border-none rounded-xl px-4 py-1 font-bold">INTEGRAÇÃO POSTHOG EM BREVE</Badge>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

