import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import { Panel, money, RankRow, EmptyState } from "./ui";
import { cn } from "@/lib/utils";

const GOLD = "#D4AF37";
const axis = { stroke: "rgba(255,255,255,0.35)", fontSize: 11 };

const chartTooltip = {
  contentStyle: {
    background: "rgba(10,12,18,0.95)",
    border: "1px solid rgba(212,175,55,0.35)",
    borderRadius: 12,
    fontSize: 12,
  },
};

export function RevenueChart({ data }: { data: { label: string; revenue: number }[] }) {
  return (
    <Panel title="Receita de produtos" description="Últimos 30 dias">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="commerceGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={54} />
            <RTooltip {...chartTooltip} formatter={(v: any) => [money(Number(v)), "Receita"]} />
            <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2} fill="url(#commerceGold)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function MonthlyChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  return (
    <Panel title="Evolução mensal" description="Receita e pedidos nos últimos 12 meses">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={54} />
            <RTooltip {...chartTooltip} formatter={(v: any, n: any) => [n === "revenue" ? money(Number(v)) : v, n === "revenue" ? "Receita" : "Pedidos"]} />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === data.length - 1 ? GOLD : "rgba(212,175,55,0.35)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function CategoryChart({ data }: { data: { category: string; revenue: number; units: number }[] }) {
  if (!data.length) return <Panel title="Categorias"><EmptyState message="Sem vendas por categoria ainda." /></Panel>;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <Panel title="Categorias" description="Receita acumulada por categoria">
      <ul className="space-y-2">
        {data.slice(0, 8).map((c, i) => (
          <RankRow
            key={c.category}
            index={i + 1}
            title={c.category}
            subtitle={`${c.units} unidades`}
            value={money(c.revenue)}
            progress={(c.revenue / max) * 100}
          />
        ))}
      </ul>
    </Panel>
  );
}

export function RadarPanel({ items }: { items: { id: string; tone: string; title: string; description: string }[] }) {
  const tones: Record<string, string> = {
    danger: "border-rose-500/30 bg-rose-500/[0.06] text-rose-300",
    warning: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
    success: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
    info: "border-sky-500/30 bg-sky-500/[0.06] text-sky-300",
  };
  if (!items.length) return <Panel title="Radar Comercial"><EmptyState message="Sem oportunidades detectadas no momento." /></Panel>;
  return (
    <Panel title="Radar Comercial" description="Oportunidades detectadas nos seus dados">
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((o) => (
          <article
            key={o.id}
            className={cn("rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-0.5", tones[o.tone] || tones.info)}
          >
            <p className="text-sm font-black">{o.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function CrossSellPanel({ pairs }: { pairs: { a: string; b: string; count: number }[] }) {
  if (!pairs.length)
    return (
      <Panel title="Clientes também compraram">
        <EmptyState message="Ainda não há pedidos com dois ou mais produtos para gerar sugestões." />
      </Panel>
    );
  return (
    <Panel title="Clientes também compraram" description="Combinações reais do seu histórico de vendas">
      <ul className="grid gap-2 md:grid-cols-2">
        {pairs.map((p, i) => (
          <li
            key={`${p.a}-${p.b}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-[#D4AF37]/30"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {p.a} <span className="text-[#D4AF37]">+</span> {p.b}
              </p>
              <p className="text-[11px] text-muted-foreground">Combinação #{i + 1}</p>
            </div>
            <span className="shrink-0 rounded-lg bg-[#D4AF37]/15 px-2 py-1 text-[11px] font-black text-[#D4AF37]">
              {p.count}x
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
