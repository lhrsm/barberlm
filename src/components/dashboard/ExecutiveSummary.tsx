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

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 empty:hidden">
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
        <div 
          className="cursor-pointer transition-transform hover:scale-[1.02]" 
          onClick={() => window.location.href = '/calendar'}
          title="Ver na agenda"
        >
          <MetricCard
            title="Agendamentos"
            value={m.active}
            icon={<CalendarCheck className="h-5 w-5" />}
            label={`${m.completed} concluídos hoje`}
            variant="default"
          />
        </div>
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

      {appointments.length > 0 && (
        <Card className="glass border-white/5 rounded-3xl overflow-hidden mt-8">
          <CardContent className="p-0">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Próximos Atendimentos</h3>
                <p className="text-xs text-zinc-500 font-medium">Fluxo operacional de hoje</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.href = '/calendar'}
                className="text-gold hover:bg-gold/5 font-bold uppercase tracking-widest text-[10px]"
              >
                Ver Agenda Completa
              </Button>
            </div>
            <div className="divide-y divide-white/5">
              {appointments.slice(0, 5).map((appt) => (
                <div 
                  key={appt.id} 
                  className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  onClick={() => {
                    // Dispara evento para abrir detalhes se o modal existir no contexto
                    window.dispatchEvent(new CustomEvent('OPEN_APPOINTMENT_DETAILS', { detail: { id: appt.id } }));
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10 group-hover:border-gold/30 transition-colors">
                      <span className="text-[13px] font-black text-white leading-none">
                        {format(parseISO(appt.start_time), 'HH:mm')}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mt-1">
                        Início
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-white italic uppercase tracking-tight group-hover:text-gold transition-colors">
                        {appt.customers?.name || "Cliente Final"}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-medium">
                        {appt.services?.name} • {appt.barbers?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      "font-black uppercase text-[9px] px-2 py-0.5 rounded-lg border",
                      appt.status === 'confirmed' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      appt.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      appt.status === 'cancelled' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}>
                      {appt.status}
                    </Badge>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-gold transition-colors">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {appointments.length > 5 && (
              <div className="p-4 bg-white/[0.01] text-center">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  + {appointments.length - 5} outros atendimentos hoje
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

// Helper imports for the component
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

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
