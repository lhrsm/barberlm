import { useMemo, memo } from "react";
import { Lightbulb, AlertTriangle, TrendingUp, Cake, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  appointments: any[];
  stats: any;
  barbers?: any[];
  birthdaysCount?: number;
}

type Insight = { id: string; text: string; tone: "info" | "warn" | "good"; icon: any };

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const InsightsPanel = memo(({ appointments, stats, barbers = [], birthdaysCount = 0 }: Props) => {
  const insights = useMemo<Insight[]>(() => {
    const list = appointments || [];
    const out: Insight[] = [];

    const cancelled = list.filter((a) => a.status === "cancelled").length;
    const active = list.length - cancelled;
    const pending = list.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
    const completed = list.filter((a) => a.status === "completed").length;

    if (active === 0) {
      out.push({
        id: "empty",
        text: "Nenhum atendimento ativo na data selecionada. Boa oportunidade para acionar clientes inativos.",
        tone: "warn",
        icon: Clock,
      });
    }

    if (pending > 0) {
      out.push({
        id: "pending",
        text: `${pending} atendimento(s) ainda em aberto hoje. Conclua para atualizar o caixa.`,
        tone: "info",
        icon: Clock,
      });
    }

    if (cancelled > 0) {
      const rate = list.length > 0 ? (cancelled / list.length) * 100 : 0;
      out.push({
        id: "cancel",
        text: `${cancelled} cancelamento(s) na data (${rate.toFixed(0)}% da agenda).`,
        tone: rate > 20 ? "warn" : "info",
        icon: AlertTriangle,
      });
    }

    // Concentração por profissional (dados já carregados na agenda do dia)
    const byBarber = new Map<string, number>();
    list
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        const n = a.barbers?.name || "Sem profissional";
        byBarber.set(n, (byBarber.get(n) || 0) + 1);
      });
    let top: [string, number] | null = null;
    byBarber.forEach((v, k) => {
      if (!top || v > top[1]) top = [k, v];
    });
    if (top && active > 0) {
      const [tName, tCount] = top as [string, number];
      out.push({
        id: "barber",
        text: `${tName} concentra ${tCount} de ${active} atendimentos do dia.`,
        tone: "info",
        icon: TrendingUp,
      });
    }

    const idleBarbers = (barbers || []).filter((b) => !byBarber.get(b.name));
    if (idleBarbers.length > 0 && active > 0) {
      out.push({
        id: "idle",
        text: `${idleBarbers.length} profissional(is) sem atendimentos hoje: ${idleBarbers
          .slice(0, 3)
          .map((b) => b.name)
          .join(", ")}.`,
        tone: "warn",
        icon: AlertTriangle,
      });
    }

    // Ticket médio hoje vs mês
    const monthlyAppts = Number(stats?.monthly?.appointments || 0);
    const ticketMonth =
      monthlyAppts > 0 ? Number(stats?.monthly?.totalServicesValue || 0) / monthlyAppts : 0;
    const ticketToday =
      completed > 0 ? Number(stats?.daily?.totalServicesValue || 0) / completed : 0;
    if (ticketMonth > 0 && ticketToday > 0) {
      const delta = ((ticketToday - ticketMonth) / ticketMonth) * 100;
      if (Math.abs(delta) >= 5) {
        out.push({
          id: "ticket",
          text: `Ticket médio de hoje (${brl(ticketToday)}) está ${delta > 0 ? "acima" : "abaixo"} da média mensal (${brl(ticketMonth)}) em ${Math.abs(delta).toFixed(0)}%.`,
          tone: delta > 0 ? "good" : "warn",
          icon: TrendingUp,
        });
      }
    }

    if (Number(stats?.total?.customerCashback || 0) > 0) {
      out.push({
        id: "cashback",
        text: `Existem ${brl(Number(stats.total.customerCashback))} em cashback disponível com ${stats.total.customersWithCashback || 0} cliente(s) — bom gatilho de retorno.`,
        tone: "info",
        icon: Lightbulb,
      });
    }

    if (birthdaysCount > 0) {
      out.push({
        id: "birthday",
        text: `${birthdaysCount} cliente(s) fazem aniversário neste mês. Envie uma condição especial.`,
        tone: "good",
        icon: Cake,
      });
    }

    if (out.length === 0) {
      out.push({
        id: "ok",
        text: "Tudo em ordem por aqui. Nenhum ponto de atenção identificado.",
        tone: "good",
        icon: CheckCircle2,
      });
    }

    return out.slice(0, 6);
  }, [appointments, stats, barbers, birthdaysCount]);

  return (
    <section
      aria-label="Insights da barbearia"
      className="rounded-3xl border border-white/5 bg-[#0b0f17]/40 p-6 h-full flex flex-col transition-all duration-300 hover:bg-[#0b0f17]/60"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold border border-gold/20">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black uppercase tracking-[0.14em] text-white italic">
            Insights
          </h3>
          <p className="truncate text-[11px] text-zinc-500 font-medium">
            Leituras automáticas da sua operação
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
        {insights.map((i) => (
          <li
            key={i.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 transition-all duration-300 hover:translate-x-1 group",
              i.tone === "warn"
                ? "border-amber-500/10 bg-amber-500/5 hover:border-amber-500/20"
                : i.tone === "good"
                  ? "border-emerald-500/10 bg-emerald-500/5 hover:border-emerald-500/20"
                  : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]",
            )}
          >
            <i.icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
                i.tone === "warn"
                  ? "text-amber-400"
                  : i.tone === "good"
                    ? "text-emerald-400"
                    : "text-sky-400",
              )}
              aria-hidden
            />
            <div className="space-y-1">
              <span className="text-[13px] leading-snug text-zinc-300 font-medium block">{i.text}</span>
              <button className="text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold/80 transition-colors pt-1">
                Ver detalhes
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
});
