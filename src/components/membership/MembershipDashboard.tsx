import React from 'react';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Target,
  Crown,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MembershipStats {
  activeCount: number;
  churnCount: number;
  totalRevenue: number;
  arr?: number;
  retentionRate?: number;
  plansCount: number;
  usageCount: number;
  plans?: Array<{ id: string; name: string; monthly_price: number; memberCount?: number }>;
}

export function MembershipDashboard({ stats }: { stats: MembershipStats }) {
  const mrr = Number(stats.totalRevenue || 0);
  const arr = Number(stats.arr || mrr * 12);
  const activeCount = Number(stats.activeCount || 0);
  const churnCount = Number(stats.churnCount || 0);
  const retention = stats.retentionRate !== undefined ? stats.retentionRate : (activeCount + churnCount > 0 ? (activeCount / (activeCount + churnCount)) * 100 : 100);
  const churnRate = activeCount + churnCount > 0 ? (churnCount / (activeCount + churnCount)) * 100 : 0;

  const cards = [
    {
      title: "Membros Ativos",
      value: String(activeCount),
      icon: Users,
      hint: activeCount > 0 ? `${activeCount} com plano vigente` : "Nenhum membro ativo",
      accent: "text-emerald-400",
      description: "Base ativa no ciclo"
    },
    {
      title: "Receita Recorrente (MRR)",
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr),
      icon: DollarSign,
      hint: "Faturamento mensal canônico",
      accent: "text-amber-400",
      description: "Soma das assinaturas ativas"
    },
    {
      title: "Receita Anualizada (ARR)",
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(arr),
      icon: TrendingUp,
      hint: "MRR × 12 projetado",
      accent: "text-purple-400",
      description: "Projeção anual de receita"
    },
    {
      title: "Taxa de Retenção",
      value: `${retention.toFixed(0)}%`,
      icon: Target,
      hint: churnCount === 0 ? "Sem churn registrado" : `${churnCount} cancelamento(s)`,
      accent: "text-sky-400",
      description: "Fidelidade da base"
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="bg-zinc-900/60 border-zinc-800 backdrop-blur-sm hover:border-gold/30 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className={cn("h-4 w-4", card.accent)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-white tracking-tight">{card.value}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <span className="text-[11px] font-medium text-zinc-400">{card.hint}</span>
                <span className="text-[10px] uppercase font-bold text-zinc-500">{card.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DETAILED PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Crown className="h-5 w-5 text-gold" /> Estrutura do Clube Barbex
                </CardTitle>
                <CardDescription className="text-zinc-400 mt-1">
                  Distribuição de planos e capacidade de atendimento da barbearia
                </CardDescription>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-400">Dados em Tempo Real</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Planos Ativos</span>
                <p className="text-2xl font-black text-white">{stats.plansCount || 0}</p>
                <span className="text-[10px] text-zinc-500">Configurados na barbearia</span>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Utilizações no Ciclo</span>
                <p className="text-2xl font-black text-white">{stats.usageCount || 0}</p>
                <span className="text-[10px] text-zinc-500">Unidades consumidas</span>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Ticket Médio</span>
                <p className="text-2xl font-black text-gold">
                  {activeCount > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr / activeCount) : "R$ 0,00"}
                </p>
                <span className="text-[10px] text-zinc-500">Por membro ativo</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>Status da base: <strong>{activeCount} assinante(s) ativo(s)</strong> gerando <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr)}/mês</strong>.</span>
              <span className="text-zinc-500 font-mono">Sem histórico anterior suficiente para comparativo percentual</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" /> Saúde da Operação
            </CardTitle>
            <CardDescription className="text-zinc-400">Indicadores de retenção e risco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 font-medium">Taxa de Retenção</span>
                <span className="text-white font-bold">{retention.toFixed(0)}%</span>
              </div>
              <Progress value={retention} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 font-medium">Taxa de Churn</span>
                <span className="text-white font-bold">{churnRate.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(churnRate, 100)} className="h-2 bg-zinc-800 [&>div]:bg-rose-500" />
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-gold" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white">Controle de Franquias</div>
                  <p className="text-zinc-400 mt-0.5">As utilizações do clube debitam unidades configuradas por serviço de forma atômica.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
