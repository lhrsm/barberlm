import { useMemo, memo } from "react";
import { CalendarCheck, CircleDollarSign, Target, Sparkles, Cake, Clock, Users, ArrowUpRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  name?: string | null;
  /** Agendamentos já carregados pelo dashboard (nenhuma consulta nova é feita aqui). */
  appointments: any[];
  stats: any;
  birthdaysCount?: number;
  loading?: boolean;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ExecutiveSummary = memo(({ name, appointments, stats, birthdaysCount = 0, loading }: Props) => {
  const m = useMemo(() => {
    const list = appointments || [];
    const total = list.length;
    const cancelled = list.filter((a) => a.status === "cancelled").length;
    const completed = list.filter((a) => a.status === "completed").length;
    const pending = list.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
    const active = total - cancelled;
    const completionRate = active > 0 ? (completed / active) * 100 : 0;
    const revenue = Number(stats?.daily?.realCashInflow || 0);
    const services = Number(stats?.daily?.totalServicesValue || 0);
    const ticketToday = completed > 0 ? services / completed : 0;
    const monthlyAppts = Number(stats?.monthly?.appointments || 0);
    const ticketMonth =
      monthlyAppts > 0 ? Number(stats?.monthly?.totalServicesValue || 0) / monthlyAppts : 0;
    const ticketDelta = ticketMonth > 0 ? ((ticketToday - ticketMonth) / ticketMonth) * 100 : null;
    return {
      total,
      cancelled,
      completed,
      pending,
      active,
      completionRate,
      revenue,
      ticketToday,
      ticketDelta,
      newCustomers: Number(stats?.daily?.newCustomers || 0),
    };
  }, [appointments, stats]);

  const chips = [
    {
      icon: CalendarCheck,
      label: "Atendimentos hoje",
      value: String(m.active),
      tone: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    },
    {
      icon: Clock,
      label: "Em aberto",
      value: String(m.pending),
      tone: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Target,
      label: "Taxa de conclusão",
      value: `${m.completionRate.toFixed(0)}%`,
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: CircleDollarSign,
      label: "Entrada em caixa",
      value: brl(m.revenue),
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Sparkles,
      label: "Ticket médio hoje",
      value: brl(m.ticketToday),
      tone: "text-purple-300 bg-purple-500/10 border-purple-500/20",
    },
    ...(birthdaysCount > 0
      ? [
          {
            icon: Cake,
            label: "Aniversariantes",
            value: String(birthdaysCount),
            tone: "text-pink-300 bg-pink-500/10 border-pink-500/20",
          },
        ]
      : []),
  ];

  const sentence = [
    `Hoje sua agenda possui ${m.active} atendimento${m.active === 1 ? "" : "s"}.`,
    m.pending > 0 ? `${m.pending} ainda aguardam conclusão.` : "Nenhum horário pendente no momento.",
    `A entrada em caixa é de ${brl(m.revenue)}.`,
    m.ticketDelta != null && Math.abs(m.ticketDelta) >= 1
      ? `O ticket médio de hoje está ${m.ticketDelta > 0 ? "acima" : "abaixo"} da média do mês em ${Math.abs(m.ticketDelta).toFixed(0)}%.`
      : "",
    m.newCustomers > 0 ? `${m.newCustomers} novo(s) cliente(s) cadastrado(s).` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Badge variant="gold" className="px-4 py-1.5 uppercase tracking-widest font-black text-[10px] animate-glow">
            <Sparkles className="h-3 w-3 mr-2 fill-current" />
            Visão Executiva
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tightest">
            {greeting()}, <span className="text-gradient-gold italic">{name?.split(' ')[0] || 'Comandante'}</span>
          </h1>
          <p className="text-muted-foreground font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-gold/60" />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>

        {birthdaysCount > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gold/5 border border-gold/20 shadow-gold/5 animate-bounce">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Cake className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gold/60">Aniversariantes</div>
              <div className="text-sm font-black">{birthdaysCount} clientes celebram hoje</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Faturamento Hoje"
          value={brl(m.revenue)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          trend={m.ticketDelta}
          label="vs média mensal"
          variant="gold"
        />
        <MetricCard
          title="Agendamentos"
          value={m.active}
          icon={<CalendarCheck className="h-5 w-5" />}
          label={`${m.completed} concluídos hoje`}
          variant="default"
        />
        <MetricCard
          title="Taxa de Ocupação"
          value={`${m.completionRate.toFixed(0)}%`}
          icon={<Target className="h-5 w-5" />}
          label="Eficiência de atendimento"
          variant="default"
        />
        <MetricCard
          title="Novos Clientes"
          value={m.newCustomers}
          icon={<Users className="h-5 w-5" />}
          label="Expansão da base"
          variant="default"
        />
      </div>
    </div>
  );
});

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number | null;
  label: string;
  variant?: 'gold' | 'default';
}

function MetricCard({ title, value, icon, trend, label, variant = 'default' }: MetricCardProps) {
  return (
    <Card className={cn(
      "relative group overflow-hidden shine",
      variant === 'gold' && "border-gold/20 bg-gold/[0.03]"
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
            variant === 'gold' ? "bg-gold/10 text-gold" : "bg-surface-raised text-muted-foreground"
          )}>
            {icon}
          </div>
          {trend !== undefined && trend !== null && (
            <Badge variant={trend >= 0 ? "success" : "destructive"} className="font-black text-[10px]">
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </Badge>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{title}</div>
          <div className="text-3xl font-black tracking-tight">{value}</div>
          <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
            {label}
            {trend !== undefined && trend !== null && <ArrowUpRight className={cn("h-3 w-3", trend >= 0 ? "text-success" : "text-destructive")} />}
          </div>
        </div>
      </CardContent>
      
      {variant === 'gold' && (
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gold/5 blur-3xl rounded-full" />
      )}
    </Card>
  );
}
