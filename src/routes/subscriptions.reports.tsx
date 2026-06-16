import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, TrendingDown, UserPlus, TrendingUp, Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/subscriptions/reports")({
  component: SubscriptionsReportsPage,
});

type SubRow = {
  id: string;
  status: string;
  started_at: string;
  canceled_at: string | null;
  created_at: string;
  plan: { monthly_price: number | null } | null;
};

const COHORT_MONTHS = 7; // Mês 0..6
const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function SubscriptionsReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const tenantId = user?.id;
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customer_subscriptions")
        .select("id,status,started_at,canceled_at,created_at,plan:subscription_plans(monthly_price)")
        .eq("tenant_id", tenantId)
        .order("started_at", { ascending: true });
      setSubs((data as any) || []);
      setLoading(false);
    })();
  }, [authLoading, tenantId]);

  // ----- Cohort -----
  const cohort = useMemo(() => {
    if (!subs.length) return { rows: [] as any[], maxMonth: 0 };
    const now = new Date();
    // last 12 cohort months
    const cohortKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      cohortKeys.push(monthKey(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -i)));
    }
    const byCohort: Record<string, SubRow[]> = {};
    for (const k of cohortKeys) byCohort[k] = [];
    for (const s of subs) {
      const start = new Date(s.started_at);
      const k = monthKey(start);
      if (byCohort[k]) byCohort[k].push(s);
    }
    const rows = cohortKeys.map((k) => {
      const cohortSubs = byCohort[k];
      const total = cohortSubs.length;
      const [y, m] = k.split("-").map(Number);
      const cohortStart = new Date(y, m - 1, 1);
      const monthsSince = monthsBetween(cohortStart, new Date(now.getFullYear(), now.getMonth(), 1));
      const cells: (number | null)[] = [];
      for (let i = 0; i < COHORT_MONTHS; i++) {
        if (i > monthsSince) {
          cells.push(null);
          continue;
        }
        if (total === 0) {
          cells.push(0);
          continue;
        }
        // active at cohort start + i months = sub.canceled_at null OR canceled after that month
        const checkpoint = addMonths(cohortStart, i + 1); // end of month i
        const stillActive = cohortSubs.filter((s) => {
          if (!s.canceled_at) return true;
          return new Date(s.canceled_at) >= checkpoint;
        }).length;
        cells.push(total === 0 ? 0 : (stillActive / total) * 100);
      }
      return { key: k, label: monthLabel(k), total, cells };
    });
    return { rows, maxMonth: COHORT_MONTHS };
  }, [subs]);

  // ----- KPIs and Forecast -----
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = subs.filter((s) => s.status === "active" || s.status === "paused");
    const mrr = active.reduce((acc, s) => acc + (Number(s.plan?.monthly_price) || 0), 0);

    // history: 6 past months — new subs / churned / net
    const history: { key: string; label: string; news: number; churn: number; activeEnd: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = addMonths(monthStart, -i);
      const end = addMonths(start, 1);
      const news = subs.filter(
        (s) => new Date(s.started_at) >= start && new Date(s.started_at) < end
      ).length;
      const churn = subs.filter(
        (s) => s.canceled_at && new Date(s.canceled_at) >= start && new Date(s.canceled_at) < end
      ).length;
      const activeEnd = subs.filter((s) => {
        const sd = new Date(s.started_at);
        if (sd >= end) return false;
        if (s.canceled_at && new Date(s.canceled_at) < end) return false;
        return true;
      }).length;
      history.push({ key: monthKey(start), label: monthLabel(monthKey(start)), news, churn, activeEnd });
    }

    const avgNew = history.reduce((a, b) => a + b.news, 0) / (history.length || 1);
    const avgChurnCount = history.reduce((a, b) => a + b.churn, 0) / (history.length || 1);
    const avgActive = history.reduce((a, b) => a + b.activeEnd, 0) / (history.length || 1) || 1;
    const churnRate = Math.min(avgChurnCount / avgActive, 0.95); // mensal

    // avg ticket
    const avgTicket = active.length ? mrr / active.length : 0;

    // Forecast next 3 months (compounding)
    let forecastActive = active.length;
    const forecast: { month: number; activeProj: number; mrrProj: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      forecastActive = forecastActive * (1 - churnRate) + avgNew;
      forecast.push({
        month: i * 30,
        activeProj: Math.round(forecastActive),
        mrrProj: Math.round(forecastActive * avgTicket),
      });
    }

    // current month churn rate (for KPI)
    const newThisMonth = subs.filter((s) => new Date(s.started_at) >= monthStart).length;
    const canceledThisMonth = subs.filter(
      (s) => s.canceled_at && new Date(s.canceled_at) >= monthStart
    ).length;
    const startOfMonthActive = active.length + canceledThisMonth - newThisMonth;
    const monthlyChurn = startOfMonthActive > 0 ? (canceledThisMonth / startOfMonthActive) * 100 : 0;

    const chartData = [
      ...history.map((h) => ({
        label: h.label,
        MRR: h.activeEnd * avgTicket,
        type: "real",
      })),
      ...forecast.map((f, idx) => ({
        label: `+${f.month}d`,
        MRR: f.mrrProj,
        type: "forecast",
      })),
    ];

    return {
      mrr,
      activeCount: active.length,
      avgTicket,
      avgNew,
      churnRate: churnRate * 100,
      monthlyChurn,
      newThisMonth,
      canceledThisMonth,
      forecast,
      chartData,
      history,
    };
  }, [subs]);

  function heatColor(pct: number | null) {
    if (pct === null) return "bg-white/2 text-gray-600";
    if (pct >= 85) return "bg-emerald-500/80 text-white";
    if (pct >= 70) return "bg-emerald-500/55 text-white";
    if (pct >= 55) return "bg-amber-500/55 text-white";
    if (pct >= 35) return "bg-orange-500/60 text-white";
    if (pct > 0) return "bg-rose-500/60 text-white";
    return "bg-zinc-700/40 text-gray-300";
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/subscriptions" className="text-xs text-gray-400 hover:text-white flex items-center gap-1 uppercase tracking-widest font-bold">
              <ArrowLeft size={14} /> Assinaturas
            </Link>
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-white italic uppercase">
            Relatórios de Assinaturas
          </h2>
          <p className="text-gray-400 font-medium">Cohort de retenção e previsão de MRR.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-purple-400" size={32} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              label="MRR Atual"
              value={BRL(metrics.mrr)}
              icon={DollarSign}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
              sub={`${metrics.activeCount} assinantes ativos`}
            />
            <KpiCard
              label="Churn Mensal"
              value={`${metrics.monthlyChurn.toFixed(1)}%`}
              icon={TrendingDown}
              color="text-rose-400"
              bg="bg-rose-500/10"
              sub={`${metrics.canceledThisMonth} cancelados no mês`}
            />
            <KpiCard
              label="Novos Assinantes"
              value={String(metrics.newThisMonth)}
              icon={UserPlus}
              color="text-purple-400"
              bg="bg-purple-500/10"
              sub={`Média 6m: ${metrics.avgNew.toFixed(1)}/mês`}
            />
            <KpiCard
              label="Receita Prevista 90d"
              value={BRL(metrics.forecast[2]?.mrrProj || 0)}
              icon={TrendingUp}
              color="text-amber-400"
              bg="bg-amber-500/10"
              sub={`~${metrics.forecast[2]?.activeProj || 0} assinantes`}
            />
          </div>

          {/* Forecast cards */}
          <Card className="glass border-white/5 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-white text-xl font-black italic uppercase tracking-tighter">
                Forecast MRR
              </CardTitle>
              <CardDescription className="text-gray-400">
                Projeção baseada em churn médio ({metrics.churnRate.toFixed(1)}%/mês) e entrada média de
                novos assinantes ({metrics.avgNew.toFixed(1)}/mês).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.forecast.map((f) => (
                  <div
                    key={f.month}
                    className="rounded-2xl bg-white/5 border border-white/10 p-5"
                  >
                    <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                      Em {f.month} dias
                    </div>
                    <div className="text-3xl font-black text-white mt-2">{BRL(f.mrrProj)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ~{f.activeProj} assinantes projetados
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-72 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.chartData}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#666" fontSize={11} />
                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                    <Tooltip
                      contentStyle={{
                        background: "#0a0a0a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                      formatter={(v: any) => BRL(Number(v))}
                    />
                    <ReferenceLine
                      x={metrics.history[metrics.history.length - 1]?.label}
                      stroke="#a855f7"
                      strokeDasharray="3 3"
                      label={{ value: "hoje", fill: "#a855f7", fontSize: 10 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="MRR"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#mrrGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cohort Heatmap */}
          <Card className="glass border-white/5 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-white text-xl font-black italic uppercase tracking-tighter">
                Cohort de Retenção
              </CardTitle>
              <CardDescription className="text-gray-400">
                Percentual de assinantes ativos por mês desde a entrada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs uppercase tracking-widest font-bold text-gray-500 py-2 pr-4">
                        Mês de entrada
                      </th>
                      <th className="text-center text-xs uppercase tracking-widest font-bold text-gray-500 py-2 px-2">
                        Total
                      </th>
                      {Array.from({ length: COHORT_MONTHS }).map((_, i) => (
                        <th
                          key={i}
                          className="text-center text-xs uppercase tracking-widest font-bold text-gray-500 py-2 px-1"
                        >
                          M{i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.rows.map((row) => (
                      <tr key={row.key} className="border-t border-white/5">
                        <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">
                          {row.label}
                        </td>
                        <td className="py-2 px-2 text-center text-gray-300">{row.total}</td>
                        {row.cells.map((c: number | null, i: number) => (
                          <td key={i} className="p-1">
                            <div
                              className={`rounded-md py-2 text-center text-xs font-bold ${heatColor(c)}`}
                            >
                              {c === null ? "—" : `${c.toFixed(0)}%`}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {cohort.rows.every((r) => r.total === 0) && (
                      <tr>
                        <td colSpan={COHORT_MONTHS + 2} className="text-center text-gray-500 py-8">
                          Sem assinaturas no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 mt-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                <span>Retenção:</span>
                <Legend swatch="bg-rose-500/60" label="< 35%" />
                <Legend swatch="bg-orange-500/60" label="35-55" />
                <Legend swatch="bg-amber-500/55" label="55-70" />
                <Legend swatch="bg-emerald-500/55" label="70-85" />
                <Legend swatch="bg-emerald-500/80" label="≥ 85%" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <Card className="glass border-white/5 rounded-3xl">
      <CardContent className="p-6">
        <div className={`p-3 rounded-2xl inline-flex ${bg}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
            {label}
          </div>
          <div className="text-3xl font-black text-white mt-1">{value}</div>
          {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-3 h-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}
