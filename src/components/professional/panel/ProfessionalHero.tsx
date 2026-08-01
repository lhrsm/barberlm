import { memo } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarCheck, Clock, CircleDollarSign, Target, Sparkles } from "lucide-react";
import { brl, type TodaySummary } from "./metrics";

interface Props {
  name: string;
  barber: any;
  today: TodaySummary;
  goal: number;
  productionMonth: number;
  actions?: React.ReactNode;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const ProfessionalHero = memo(function ProfessionalHero({
  name,
  barber,
  today,
  goal,
  productionMonth,
  actions,
}: Props) {
  const goalPct = goal > 0 ? Math.min(100, (productionMonth / goal) * 100) : 0;
  const specialties: string[] = Array.isArray(barber?.specialties) ? barber.specialties : [];

  return (
    <section
      aria-label="Resumo do profissional"
      className="relative overflow-hidden rounded-2xl border border-gold/25 bg-[#0b0f17] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-gold shadow-[0_0_24px_rgba(212,175,55,0.35)]">
              <AvatarImage src={barber?.avatar_url} alt={`Foto de ${name}`} />
              <AvatarFallback className="bg-gold/10 text-gold text-2xl font-black">
                {name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold">
                {greeting()}, bom trabalho hoje
              </p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white truncate">{name} 👋</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "px-3 py-1 border-0 text-[10px] font-black uppercase tracking-wider",
                    barber?.active ? "bg-green-600 text-white" : "bg-red-600 text-white",
                  )}
                >
                  {barber?.active ? "🟢 Disponível" : "🔴 Indisponível"}
                </Badge>
                <Badge className="px-3 py-1 border-0 bg-gold text-black text-[10px] font-black uppercase tracking-wider">
                  👑 {barber?.category || "Profissional"}
                </Badge>
                {specialties.slice(0, 3).map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="border-gold/25 bg-gold/5 text-gold text-[9px] font-black uppercase tracking-wider"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HeroStat
            icon={CalendarCheck}
            label="Atendimentos hoje"
            value={`${today.completedToday.length}/${today.todayAppts.length}`}
            hint={`${today.pendingToday.length} pendentes`}
          />
          <HeroStat
            icon={Clock}
            label="Próximo cliente"
            value={today.next ? format(new Date(today.next.start_time), "HH:mm") : "—"}
            hint={
              today.next
                ? `${today.next.customers?.name || "Cliente"}${
                    today.minutesToNext !== null && today.minutesToNext >= 0 ? ` • em ${today.minutesToNext} min` : ""
                  }`
                : "Sem próximos hoje"
            }
            highlight={today.minutesToNext !== null && today.minutesToNext >= 0 && today.minutesToNext <= 15}
          />
          <HeroStat icon={CircleDollarSign} label="Receita de hoje" value={brl(today.revenueToday)} hint={`Ticket ${brl(today.ticketToday)}`} />
          <HeroStat
            icon={Target}
            label="Meta do mês"
            value={goal > 0 ? `${goalPct.toFixed(0)}%` : "—"}
            hint={goal > 0 ? `${brl(productionMonth)} de ${brl(goal)}` : "Nenhuma meta definida"}
          />
        </div>

        {goal > 0 && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-white/5"
            role="progressbar"
            aria-valuenow={Math.round(goalPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta mensal"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-[#F0D67B] transition-[width] duration-700"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        )}

        {today.minutesToNext !== null && today.minutesToNext >= 0 && today.minutesToNext <= 15 && today.next && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-bold text-gold animate-in fade-in">
            <Sparkles size={16} aria-hidden />
            Próximo em {today.minutesToNext} min — {today.next.customers?.name || "Cliente"} (
            {today.next.services?.name || "serviço"})
          </div>
        )}
      </div>
    </section>
  );
});

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5",
        highlight ? "border-gold/50 bg-gold/10" : "border-white/10 bg-white/[0.03] hover:border-gold/30",
      )}
    >
      <div className="flex items-center gap-2 text-gold">
        <Icon size={14} aria-hidden />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-1 truncate text-xl font-black text-white">{value}</p>
      {hint && <p className="truncate text-[10px] font-medium text-white/45">{hint}</p>}
    </div>
  );
}
