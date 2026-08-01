import { memo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Users, Package, Clock } from "lucide-react";
import { brl, type EvolutionData } from "./metrics";

interface Props {
  evo: EvolutionData;
  reviews: any[];
  productSales: any[];
}

const tooltipStyle = {
  background: "#0b0f17",
  border: "1px solid rgba(212,175,55,0.3)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
} as const;

export const ProfessionalEvolution = memo(function ProfessionalEvolution({ evo, reviews, productSales }: Props) {
  const ratings = reviews.map((r) => Number(r.barber_rating || 0)).filter((n) => n > 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const productMap: Record<string, { name: string; qty: number; total: number }> = {};
  productSales.forEach((s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    items.forEach((it: any) => {
      const name = it?.name || it?.product_name || "Produto";
      const qty = Number(it?.quantity || 1);
      const price = Number(it?.price || it?.unit_price || 0) * qty;
      productMap[name] = productMap[name] || { name, qty: 0, total: 0 };
      productMap[name].qty += qty;
      productMap[name].total += price;
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 6);
  const productTotal = productSales.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <section aria-label="Receita dos últimos 12 meses" className="rounded-2xl border border-gold/15 bg-[#0b0f17] p-5 md:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Minha Evolução</p>
        <h3 className="mb-4 text-lg font-black text-white">Receita dos últimos 12 meses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evo.monthly}>
              <defs>
                <linearGradient id="profRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [n === "revenue" ? brl(Number(v)) : v, n === "revenue" ? "Receita" : "Atendimentos"]} />
              <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#profRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Atendimentos por semana" subtitle="Últimas 8 semanas">
          <BarChart data={evo.weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={32} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Atendimentos" radius={[6, 6, 0, 0]} fill="#D4AF37" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Ticket médio mensal" subtitle="Últimos 12 meses">
          <AreaChart data={evo.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
            <Area type="monotone" dataKey="ticket" name="Ticket médio" stroke="#F0D67B" strokeWidth={2} fill="rgba(240,214,123,0.12)" />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Dia da semana mais produtivo" subtitle="Receita acumulada">
          <BarChart data={evo.weekdays}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
            <Bar dataKey="revenue" name="Receita" radius={[6, 6, 0, 0]}>
              {evo.weekdays.map((w) => (
                <Cell key={w.label} fill={w.label === evo.bestWeekday ? "#D4AF37" : "rgba(212,175,55,0.35)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Horário de maior faturamento" subtitle="Receita por hora de início">
          <BarChart data={evo.hours}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
            <Bar dataKey="revenue" name="Receita" radius={[6, 6, 0, 0]}>
              {evo.hours.map((h) => (
                <Cell key={h.label} fill={h.label === evo.bestHour ? "#D4AF37" : "rgba(212,175,55,0.35)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Serviços mais realizados" icon={Trophy}>
          {evo.topServices.length === 0 ? (
            <Empty />
          ) : (
            evo.topServices.map((s) => {
              const max = evo.topServices[0].total || 1;
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span className="truncate">{s.name}</span>
                    <span className="font-bold text-white">
                      {brl(s.total)}
                      <Badge className="ml-2 border-0 bg-white/10 text-[10px] text-white/70">{s.count}x</Badge>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-[#F0D67B] transition-[width] duration-700"
                      style={{ width: `${Math.max(6, (s.total / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </ListCard>

        <ListCard title="Meus clientes" icon={Users}>
          {evo.topClients.length === 0 ? (
            <Empty />
          ) : (
            evo.topClients.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition-colors hover:border-gold/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {c.name}
                    {idx === 0 && <span className="ml-2 text-[10px] font-black uppercase text-gold">Mais fiel</span>}
                    {c.count >= 5 && idx !== 0 && (
                      <span className="ml-2 text-[10px] font-black uppercase text-gold/70">VIP</span>
                    )}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {c.count} atendimentos • último em {format(new Date(c.last), "dd/MM/yyyy")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-gold">{brl(c.total)}</span>
              </div>
            ))
          )}
        </ListCard>

        <ListCard title="Produtos vendidos" icon={Package}>
          <div className="mb-2 flex items-center gap-2 text-xs text-white/50">
            <span className="font-black text-white">{productSales.length}</span> vendas •
            <span className="font-black text-gold">{brl(productTotal)}</span>
          </div>
          {topProducts.length === 0 ? (
            <Empty text="Nenhum produto vendido ainda." />
          ) : (
            topProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <span className="truncate text-sm text-white/85">{p.name}</span>
                <span className="shrink-0 text-xs font-black text-gold">
                  {p.qty}x • {brl(p.total)}
                </span>
              </div>
            ))
          )}
        </ListCard>

        <ListCard title="Minhas avaliações" icon={Star}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl font-black text-white">{avgRating ? avgRating.toFixed(1) : "—"}</span>
            <span className="text-xs text-white/45">{ratings.length} avaliações</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-black uppercase text-white/40">
              <Clock size={11} aria-hidden /> {evo.avgDurationMin || "—"} min médios
            </span>
          </div>
          {reviews.length === 0 ? (
            <Empty text="Nenhuma avaliação recebida ainda." />
          ) : (
            reviews.slice(0, 5).map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5" aria-label={`Nota ${r.barber_rating || 0} de 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        className={n <= Number(r.barber_rating || 0) ? "fill-gold text-gold" : "text-white/20"}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-white/35">
                    {format(new Date(r.submitted_at || r.created_at), "dd/MM/yyyy")}
                  </span>
                </div>
                {r.testimonial_text && <p className="mt-2 text-xs text-white/70">"{r.testimonial_text}"</p>}
                {r.reply && (
                  <p className="mt-2 rounded-lg border-l-2 border-gold/50 bg-gold/5 px-3 py-2 text-[11px] text-white/60">
                    <span className="font-black uppercase text-gold">Resposta da barbearia:</span> {r.reply}
                  </p>
                )}
              </div>
            ))
          )}
        </ListCard>
      </div>
    </div>
  );
});

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: any }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-gold/15 bg-[#0b0f17] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">{subtitle}</p>
      <h3 className="mb-3 text-base font-black text-white">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ListCard({ title, icon: Icon, children }: { title: string; icon: any; children: any }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-gold/15 bg-[#0b0f17] p-5">
      <div className="mb-3 flex items-center gap-2 text-gold">
        <Icon size={14} aria-hidden />
        <h3 className="text-[11px] font-black uppercase tracking-widest">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ text = "Sem dados no período." }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-white/40">{text}</p>;
}
