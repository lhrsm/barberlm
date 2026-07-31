import { useMemo } from "react";
import { CalendarCheck, CircleDollarSign, Target, Sparkles, Cake, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function ExecutiveSummary({ name, appointments, stats, birthdaysCount = 0, loading }: Props) {
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
    <section
      aria-label="Resumo executivo"
      className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#0b0f17] via-[#0b0f17] to-[#12100a] p-5 md:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-500/10 blur-[90px]"
      />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-px w-8 bg-amber-500" aria-hidden />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
            Resumo executivo
          </span>
        </div>

        <div>
          <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">
            {greeting()}
            {name ? `, ${String(name).split(" ")[0]}` : ""}.
          </h2>
          {loading ? (
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">{sentence}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <div
              key={c.label}
              className={cn(
                "inline-flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 transition-transform duration-300 hover:-translate-y-0.5",
                c.tone,
              )}
              title={c.label}
            >
              <c.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {c.label}
              </span>
              <span className="truncate text-sm font-black">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
