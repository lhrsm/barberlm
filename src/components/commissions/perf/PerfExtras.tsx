import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, Flag, Sparkles, Trophy } from "lucide-react";
import { Panel, SectionTitle, MiniStat } from "./ui";
import { fmtBRL, WEEKDAYS, type PerfModel } from "./engine";

/* ------------------------------- HEATMAP -------------------------------- */

export function EarningsHeatmap({ model }: { model: PerfModel }) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 07h - 21h
  return (
    <Panel>
      <SectionTitle
        title="Mapa de Ganhos"
        subtitle="Receita por dia da semana e horário"
        icon={Sparkles}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-20" />
              {hours.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-[9px] font-black uppercase tracking-wider text-zinc-500"
                >
                  {String(h).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day, d) => (
              <tr key={day}>
                <th
                  scope="row"
                  className="pr-2 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500"
                >
                  {day.slice(0, 3)}
                </th>
                {hours.map((h) => {
                  const v = model.heat[d][h] ?? 0;
                  const ratio = v / model.heatMax;
                  return (
                    <td key={h}>
                      <div
                        title={`${day} ${String(h).padStart(2, "0")}h — ${fmtBRL(v)}`}
                        aria-label={`${day} ${h} horas: ${fmtBRL(v)}`}
                        className="h-7 w-full rounded-md border border-zinc-800/70 transition-transform duration-200 hover:scale-110"
                        style={{
                          background:
                            v > 0
                              ? `rgba(212,175,55,${0.12 + ratio * 0.78})`
                              : "rgba(255,255,255,0.02)",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
        <span>Menos</span>
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((o) => (
          <span
            key={o}
            className="h-3 w-6 rounded"
            style={{ background: `rgba(212,175,55,${o})` }}
          />
        ))}
        <span>Mais</span>
      </div>
    </Panel>
  );
}

/* ------------------------------- FORECAST ------------------------------- */

export function ForecastPanel({ model }: { model: PerfModel }) {
  const f = model.forecast;
  const items = [
    { label: "Mínimo esperado", value: f.min, tone: "amber" as const },
    { label: "Média projetada", value: f.projected, tone: "gold" as const },
    { label: "Melhor cenário", value: f.best, tone: "emerald" as const },
  ];
  return (
    <Panel>
      <SectionTitle
        title="Previsão de Ganhos"
        subtitle="Baseada apenas no seu histórico do mês corrente"
        icon={Flag}
      />
      <p className="mt-4 text-sm text-zinc-400">
        Mantendo sua média atual de{" "}
        <strong className="text-white">{fmtBRL(f.dailyAvg)}</strong> por dia, sua
        comissão prevista para este mês é de{" "}
        <strong className="text-[#D4AF37]">{fmtBRL(f.projected)}</strong>.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <MiniStat key={i.label} label={i.label} value={fmtBRL(i.value)} tone={i.tone} />
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wider">
          <span className="text-zinc-500">
            Acumulado: {fmtBRL(f.current)}
          </span>
          <span className="text-[#D4AF37]">
            {f.daysLeft} dia(s) restantes
          </span>
        </div>
        <Progress
          value={f.projected > 0 ? Math.min(100, (f.current / f.projected) * 100) : 0}
          className="h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-[#D4AF37] [&>div]:to-amber-300"
        />
      </div>
    </Panel>
  );
}

/* ------------------------------- SIMULATOR ------------------------------ */

export function CommissionSimulator({ model }: { model: PerfModel }) {
  const [extraServices, setExtraServices] = useState(10);
  const [extraProducts, setExtraProducts] = useState(5);
  const [serviceTicket, setServiceTicket] = useState(
    Math.round(model.hero.avgTicket) || 60,
  );
  const [productTicket, setProductTicket] = useState(
    model.byProduct.length
      ? Math.round(model.byProduct[0].revenue / Math.max(1, model.byProduct[0].units))
      : 40,
  );

  const ratio = model.commissionRatio;
  const sim = useMemo(() => {
    const serviceRevenue = extraServices * serviceTicket;
    const productRevenue = extraProducts * productTicket;
    return {
      serviceRevenue,
      productRevenue,
      serviceCommission: serviceRevenue * ratio,
      productCommission: productRevenue * ratio,
      total: (serviceRevenue + productRevenue) * ratio,
    };
  }, [extraServices, extraProducts, serviceTicket, productTicket, ratio]);

  return (
    <Panel>
      <SectionTitle
        title="Simulador de Comissão"
        subtitle="Projeção informativa — não altera nenhum cálculo real"
        icon={Calculator}
      />
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Atendimentos adicionais: {extraServices}
            </Label>
            <Slider
              value={[extraServices]}
              onValueChange={(v) => setExtraServices(v[0])}
              min={0}
              max={100}
              step={1}
              aria-label="Atendimentos adicionais"
            />
          </div>
          <div>
            <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Produtos adicionais: {extraProducts}
            </Label>
            <Slider
              value={[extraProducts]}
              onValueChange={(v) => setExtraProducts(v[0])}
              min={0}
              max={100}
              step={1}
              aria-label="Produtos adicionais"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Ticket do serviço
              </Label>
              <Input
                type="number"
                value={serviceTicket}
                onChange={(e) => setServiceTicket(Number(e.target.value) || 0)}
                className="h-10 border-zinc-800 bg-[#05070d] text-white focus-visible:border-[#D4AF37]/60"
              />
            </div>
            <div>
              <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Ticket do produto
              </Label>
              <Input
                type="number"
                value={productTicket}
                onChange={(e) => setProductTicket(Number(e.target.value) || 0)}
                className="h-10 border-zinc-800 bg-[#05070d] text-white focus-visible:border-[#D4AF37]/60"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/10 to-transparent p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/80">
            Comissão adicional estimada
          </p>
          <p className="mt-1 text-3xl font-black text-[#D4AF37]">
            {fmtBRL(sim.total)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Serviços" value={fmtBRL(sim.serviceCommission)} />
            <MiniStat label="Produtos" value={fmtBRL(sim.productCommission)} />
            <MiniStat label="Receita gerada" value={fmtBRL(sim.serviceRevenue + sim.productRevenue)} />
            <MiniStat
              label="Taxa efetiva atual"
              value={`${(ratio * 100).toFixed(1)}%`}
              tone="gold"
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            A taxa efetiva é obtida dos lançamentos de comissão já existentes no
            período selecionado. Nenhum valor é gravado no sistema.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------- GOALS -------------------------------- */

export function GoalsPanel({
  model,
  barbers,
}: {
  model: PerfModel;
  barbers: { id: string; name: string; monthly_goal: number }[];
}) {
  const rows = model.ranking.length
    ? model.ranking
    : barbers.map((b) => ({
        id: b.id,
        name: b.name,
        revenue: 0,
        commission: 0,
        services: 0,
        avgTicket: 0,
        products: 0,
        rating: 0,
        goal: Number(b.monthly_goal ?? 0),
      }));

  return (
    <Panel>
      <SectionTitle
        title="Metas"
        subtitle="Acompanhamento visual — as metas seguem o cadastro atual do barbeiro"
        icon={Flag}
      />
      <div className="mt-4 space-y-4">
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">
            Nenhum barbeiro cadastrado.
          </p>
        )}
        {rows.map((r) => {
          const goal = r.goal || 0;
          const goalPct = goal > 0 ? Math.min(100, (r.revenue / goal) * 100) : 0;
          const commissionGoal = goal * (model.commissionRatio || 0);
          const productGoal = goal * 0.15;
          const serviceGoal = model.hero.avgTicket
            ? Math.round(goal / model.hero.avgTicket)
            : 0;
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-zinc-800/70 bg-[#05070d]/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-white">{r.name}</span>
                {goal > 0 ? (
                  <Badge className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]">
                    {goalPct.toFixed(0)}% da meta
                  </Badge>
                ) : (
                  <Badge className="border border-zinc-700 bg-zinc-800/60 text-zinc-400">
                    Meta não definida
                  </Badge>
                )}
              </div>
              <Progress
                value={goalPct}
                className="mt-3 h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-[#D4AF37] [&>div]:to-amber-300"
              />
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MiniStat label="Meta mensal" value={goal ? fmtBRL(goal) : "—"} tone="gold" />
                <MiniStat
                  label="Meta financeira"
                  value={commissionGoal ? fmtBRL(commissionGoal) : "—"}
                />
                <MiniStat
                  label="Meta de produtos"
                  value={productGoal ? fmtBRL(productGoal) : "—"}
                />
                <MiniStat
                  label="Meta de atendimentos"
                  value={serviceGoal ? String(serviceGoal) : "—"}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* -------------------------------- BADGES -------------------------------- */

export function BadgesPanel({ model }: { model: PerfModel }) {
  return (
    <Panel>
      <SectionTitle
        title="Badges de Desempenho"
        subtitle="Conquistas informativas calculadas a partir dos dados do período"
        icon={Trophy}
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {model.badges.map((b) => (
          <div
            key={b.label}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
              b.earned
                ? "border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37]/12 to-transparent shadow-[0_8px_26px_-14px_rgba(212,175,55,0.6)]"
                : "border-zinc-800/70 bg-[#05070d]/60 opacity-60",
            )}
          >
            <span className="text-2xl" aria-hidden="true">
              {b.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{b.label}</p>
              <p className="truncate text-[11px] text-zinc-500">{b.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
