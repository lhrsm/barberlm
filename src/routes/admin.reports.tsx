import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Download,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PieChart,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

const mockData = [
  { name: "Jan", faturamento: 4000, churn: 240, growth: 10 },
  { name: "Fev", faturamento: 3000, churn: 139, growth: 12 },
  { name: "Mar", faturamento: 2000, churn: 980, growth: -5 },
  { name: "Abr", faturamento: 2780, churn: 390, growth: 15 },
  { name: "Mai", faturamento: 1890, churn: 480, growth: 8 },
  { name: "Jun", faturamento: 2390, churn: 380, growth: 20 },
];

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];

function AdminReports() {
  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic uppercase tracking-tighter">Relatórios Enterprise</h2>
          <p className="text-gray-400 font-medium">Visão analítica profunda da saúde do seu SaaS.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 bg-white/5 border-white/10 rounded-xl gap-2 text-xs font-bold uppercase tracking-widest italic">
            <Filter size={16} /> Filtrar
          </Button>
          <Button className="h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 text-xs font-bold uppercase tracking-widest italic shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <Download size={16} /> Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "MRR Atual", value: "R$ 12.450", icon: DollarSign, trend: "+12.5%", positive: true, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { title: "Churn Rate", value: "2.4%", icon: Activity, trend: "-0.8%", positive: true, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { title: "Novas Assinaturas", value: "124", icon: Users, trend: "+18%", positive: true, color: "text-purple-400", bg: "bg-purple-500/10" },
          { title: "Ticket Médio", value: "R$ 49,90", icon: Target, trend: "-2.1%", positive: false, color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map((kpi, i) => (
          <Card key={i} className="glass border-white/5 rounded-3xl overflow-hidden group hover:border-white/10 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl", kpi.bg)}>
                  <kpi.icon className={cn("w-6 h-6", kpi.color)} />
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-black italic", kpi.positive ? "text-emerald-400" : "text-rose-400")}>
                  {kpi.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {kpi.trend}
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{kpi.title}</p>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">{kpi.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 glass border-white/5 rounded-[2.5rem] p-8 overflow-hidden">
          <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
                <TrendingUp className="text-purple-400 w-5 h-5" /> Crescimento Mensal
              </CardTitle>
              <CardDescription className="text-gray-500">Acompanhamento de receita e novos clientes.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">MRR</Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Trial</Badge>
            </div>
          </CardHeader>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <defs>
                  <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#6b7280', fontSize: 10, fontWeight: 700}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#6b7280', fontSize: 10, fontWeight: 700}} 
                />
                <Tooltip 
                  contentStyle={{backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}
                  itemStyle={{color: '#fff', fontSize: '12px', fontWeight: 700}}
                />
                <Area 
                  type="monotone" 
                  dataKey="faturamento" 
                  stroke="#8B5CF6" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorFaturamento)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass border-white/5 rounded-[2.5rem] p-8">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-xl font-bold text-white italic tracking-tight uppercase flex items-center gap-2">
              <PieChart className="text-pink-400 w-5 h-5" /> Distribuição de Planos
            </CardTitle>
            <CardDescription className="text-gray-500">Onde está concentrado seu volume.</CardDescription>
          </CardHeader>
          <div className="h-[300px] w-full flex flex-col justify-center">
             <div className="space-y-6">
                {[
                  { name: "Elite", value: 45, color: "bg-purple-500" },
                  { name: "Pro", value: 35, color: "bg-pink-500" },
                  { name: "Starter", value: 20, color: "bg-blue-500" },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                      <span className="text-gray-400">{item.name}</span>
                      <span className="text-white">{item.value}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", item.color)} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

const Badge = ({ children, className, variant }: any) => (
  <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", className)}>
    {children}
  </span>
);
