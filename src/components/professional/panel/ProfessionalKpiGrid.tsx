import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  CalendarCheck,
  CircleDollarSign,
  TrendingUp,
  Users,
  Package,
  Crown,
  Star,
  CalendarClock,
  Timer,
} from "lucide-react";
import { brl, type TodaySummary } from "./metrics";

interface Props {
  today: TodaySummary;
  productsToday: { count: number; total: number };
  commissionForecast: number;
  avgRating: number | null;
  ratingsCount: number;
}

export const ProfessionalKpiGrid = memo(function ProfessionalKpiGrid({
  today,
  productsToday,
  commissionForecast,
  avgRating,
  ratingsCount,
}: Props) {
  const items = [
    { icon: CalendarCheck, label: "Atendimentos hoje", value: String(today.completedToday.length), hint: `${today.todayAppts.length} agendados` },
    { icon: CircleDollarSign, label: "Receita hoje", value: brl(today.revenueToday), hint: "concluídos" },
    { icon: TrendingUp, label: "Ticket médio", value: brl(today.ticketToday), hint: "no dia" },
    { icon: Users, label: "Clientes atendidos", value: String(today.clientsToday), hint: "únicos hoje" },
    { icon: Package, label: "Produtos vendidos", value: String(productsToday.count), hint: brl(productsToday.total) },
    { icon: Crown, label: "Comissões previstas", value: brl(commissionForecast), hint: "mês corrente" },
    {
      icon: Star,
      label: "Avaliação média",
      value: avgRating ? avgRating.toFixed(1) : "—",
      hint: `${ratingsCount} avaliações`,
    },
    { icon: CalendarClock, label: "Horários vagos", value: String(today.freeSlots), hint: `${today.occupancyPct}% ocupado` },
    { icon: Timer, label: "Tempo médio", value: today.avgDurationMin ? `${today.avgDurationMin} min` : "—", hint: "por atendimento" },
  ];

  return (
    <section aria-label="Resumo executivo do dia" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            "group rounded-2xl border border-gold/15 bg-[#0b0f17] p-4 transition-all duration-200",
            "hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_10px_28px_rgba(212,175,55,0.10)]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/45">{it.label}</span>
            <it.icon className="h-4 w-4 text-gold transition-transform duration-200 group-hover:scale-110" aria-hidden />
          </div>
          <p className="mt-2 truncate text-2xl font-black text-white">{it.value}</p>
          {it.hint && <p className="truncate text-[10px] font-medium text-white/40">{it.hint}</p>}
        </div>
      ))}
    </section>
  );
});
