import { createFileRoute } from "@tanstack/react-router";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Download,
  Calendar,
  ChevronRight,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

const monthlyData = [
  { name: "Jan", revenue: 4500, users: 12 },
  { name: "Fev", revenue: 5200, users: 15 },
  { name: "Mar", revenue: 4800, users: 18 },
  { name: "Abr", revenue: 6100, users: 22 },
  { name: "Mai", revenue: 7500, users: 30 },
  { name: "Jun", revenue: 8900, users: 45 },
];

const planDistribution = [
  { name: "Basic", value: 40, color: "#8b5cf6" },
  { name: "Pro", value: 35, color: "#ec4899" },
  { name: "Enterprise", value: 25, color: "#3b82f6" },
];

function AdminReports() {
  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic uppercase">Relatórios Analíticos</h2>
          <p className="text-gray-400 font-medium text-lg">Visão estratégica e métricas de crescimento do SaaS.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 px-6 rounded-2xl bg-white/5 border-white/10 text-white gap-2 font-bold uppercase tracking-wider text-xs italic transition-all hover:bg-white/10 hover:border-purple-500/50">
            <Calendar className="w-4 h-4 text-purple-400" />
            Últimos 30 Dias
          </Button>
          <Button className="h-12 px-8 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2 font-bold uppercase tracking-wider text-xs italic shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:scale-105 active:scale-95">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Receita Total", value: "R$ 142.500", trend: "+12.5%", positive: true, icon: DollarSign, color: "from-emerald-500/20 to-teal-500/20" },
          { label: "Novas Assinaturas", value: "+84", trend: "+5.2%", positive: true, icon: Users, color: "from-purple-500/20 to-indigo-500/20" },
          { label: "Churn Rate", value: "2.1%", trend: "-0.5%", positive: true, icon: TrendingUp, color: "from-rose-500/20 to-orange-500/20" },
          { label: "LTV Médio", value: "R$ 850", trend: "+8.4%", positive: true, icon: BarChart3, color: "from-blue-500/20 to-cyan-500/20" },
        ].map((stat, i) => (
          <Card key={i} className="glass border-white/5 rounded-3xl overflow-hidden group hover:border-white/10 transition-all duration-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br", stat.color)}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg",
                  stat.positive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  {stat.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {stat.trend}
                </div>
              </div>
              <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-white italic tracking-tighter">{stat.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass border-white/5 rounded-[2.5rem] p-8 shadow-none group overflow-hidden">
          <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-white italic tracking-tighter uppercase">Crescimento de Receita</CardTitle>
              <CardDescription className="text-gray-400 font-medium">Comparativo mensal de faturamento bruto.</CardDescription>
            </div>
          </CardHeader>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#6b7280" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass border-white/5 rounded-[2.5rem] p-8 shadow-none group overflow-hidden">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-2xl font-black text-white italic tracking-tighter uppercase">Distribuição de Planos</CardTitle>
            <CardDescription className="text-gray-400 font-medium">Market share por nível de assinatura.</CardDescription>
          </CardHeader>
          <div className="space-y-6">
            {planDistribution.map((plan, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white font-bold italic uppercase tracking-wider text-xs">{plan.name}</span>
                  <span className="text-gray-400 font-black">{plan.value}%</span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ 
                      width: `${plan.value}%`,
                      background: `linear-gradient(to right, ${plan.color}, ${plan.color}88)`
                    }} 
                  />
                </div>
              </div>
            ))}
            <div className="pt-8 mt-8 border-t border-white/5">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <PieChartIcon className="text-pink-500 w-5 h-5" />
                  <span className="text-sm text-gray-400 font-medium">Ver análise detalhada</span>
                </div>
                <ChevronRight className="text-gray-600 w-5 h-5" />
              </div>
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
