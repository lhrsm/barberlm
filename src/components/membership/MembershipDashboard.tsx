import React, { useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Target,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
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
} from 'recharts';

interface MembershipStats {
  activeCount: number;
  churnCount: number;
  totalRevenue: number;
  plansCount: number;
  usageCount: number;
}

export function MembershipDashboard({ stats }: { stats: MembershipStats }) {
  const growthRate = 12.5; // Demo values for now
  const retentionRate = 94.2;

  const cards = [
    {
      title: "Membros Ativos",
      value: stats.activeCount,
      icon: Users,
      trend: "+4.3%",
      trendType: "up",
      description: "Assinantes com plano vigente"
    },
    {
      title: "Receita Recorrente (MRR)",
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue),
      icon: DollarSign,
      trend: "+8.1%",
      trendType: "up",
      description: "Faturamento mensal projetado"
    },
    {
      title: "Taxa de Retenção",
      value: `${retentionRate}%`,
      icon: Target,
      trend: "-0.5%",
      trendType: "down",
      description: "Fidelidade dos membros"
    },
    {
      title: "Utilização de Benefícios",
      value: "68%",
      icon: Activity,
      trend: "+2.4%",
      trendType: "up",
      description: "Engajamento médio"
    }
  ];

  const data = [
    { name: 'Jan', value: 400 },
    { name: 'Fev', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Abr', value: 800 },
    { name: 'Mai', value: 500 },
    { name: 'Jun', value: 900 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="bg-zinc-900/50 border-gold-500/20 backdrop-blur-sm hover:border-gold-500/40 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-gold-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
              <div className="flex items-center mt-1">
                <span className={cn(
                  "text-xs font-medium mr-2",
                  card.trendType === 'up' ? "text-emerald-400" : "text-rose-400"
                )}>
                  {card.trend}
                </span>
                <span className="text-xs text-zinc-500">vs. mês anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-zinc-900/50 border-gold-500/20">
          <CardHeader>
            <CardTitle className="text-gold-500">Crescimento de Base</CardTitle>
            <CardDescription className="text-zinc-400">Evolução do número de assinantes ativos nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#D4AF37', color: '#fff' }}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Area type="monotone" dataKey="value" stroke="#D4AF37" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-gold-500/20">
          <CardHeader>
            <CardTitle className="text-gold-500">Saúde do Clube</CardTitle>
            <CardDescription className="text-zinc-400">Indicadores de risco e performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Churn Rate (30d)</span>
                <span className="text-white font-medium">2.1%</span>
              </div>
              <Progress value={21} className="h-1.5 bg-zinc-800" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Renovação Automática</span>
                <span className="text-white font-medium">88%</span>
              </div>
              <Progress value={88} className="h-1.5 bg-zinc-800" />
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <div className="flex gap-4">
                <div className="bg-gold-500/10 p-2 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gold-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">4 Assinaturas Vencendo</div>
                  <p className="text-xs text-zinc-500">Ações de retenção sugeridas disponíveis</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
