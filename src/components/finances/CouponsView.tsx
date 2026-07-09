import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  TicketPercent, Search, TrendingUp, CheckCircle2, XCircle, Clock, Percent, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "7d" | "30d" | "month" | "prev_month" | "90d" | "year" | "all";
type StatusFilter = "all" | "active" | "inactive" | "expired";

const GOLD = "#D4AF37";

function periodRange(p: Period): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (p) {
    case "7d": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "month": return { start: startOfMonth(now), end: endOfDay(now) };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "90d": return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    case "all": return { start: null, end: null };
  }
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minimum_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  applies_to: string | null;
  first_month_only: boolean | null;
};

type UsageRow = {
  coupon_id: string | null;
  coupon_code: string | null;
  discount_amount: number | null;
  start_time: string | null;
};

export function CouponsView({ tenantId, initialPeriod, periodKey }: { tenantId: string; initialPeriod?: Period; periodKey?: string }) {
  const [period, setPeriod] = useState<Period>(initialPeriod ?? "month");
  useEffect(() => { if (initialPeriod) setPeriod(initialPeriod); }, [periodKey, initialPeriod]);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const { start, end } = useMemo(() => periodRange(period), [period]);

  const coupons = useQuery({
    queryKey: ["finance-coupons-list", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, code, type, value, minimum_amount, max_discount, usage_limit, used_count, starts_at, expires_at, active, applies_to, first_month_only")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
  });

  const usage = useQuery({
    queryKey: ["finance-coupons-usage", tenantId, start?.toISOString(), end?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("coupon_id, coupon_code, discount_amount, start_time")
        .eq("tenant_id", tenantId)
        .not("coupon_id", "is", null);
      if (start) q = q.gte("start_time", start.toISOString());
      if (end) q = q.lte("start_time", end.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });

  const loading = coupons.isLoading || usage.isLoading;

  const stats = useMemo(() => {
    const list = coupons.data ?? [];
    const uses = usage.data ?? [];
    const now = new Date();
    const active = list.filter((c) => c.active && (!c.expires_at || new Date(c.expires_at) >= now));
    const expired = list.filter((c) => c.expires_at && new Date(c.expires_at) < now);
    const usesInPeriod = uses.length;
    const discountInPeriod = uses.reduce((s, r) => s + Number(r.discount_amount || 0), 0);

    // top coupons by usage in period
    const byCoupon = new Map<string, { code: string; uses: number; discount: number }>();
    for (const u of uses) {
      const key = u.coupon_id || u.coupon_code || "unknown";
      const label = u.coupon_code || "—";
      const cur = byCoupon.get(key) ?? { code: label, uses: 0, discount: 0 };
      cur.uses += 1;
      cur.discount += Number(u.discount_amount || 0);
      byCoupon.set(key, cur);
    }
    const top = [...byCoupon.values()].sort((a, b) => b.uses - a.uses).slice(0, 8);

    // monthly usage (last 6 months, regardless of filter for trend context)
    const monthly = new Map<string, { label: string; uses: number; discount: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const k = format(d, "yyyy-MM");
      monthly.set(k, { label: format(d, "MMM", { locale: ptBR }), uses: 0, discount: 0 });
    }
    for (const u of uses) {
      if (!u.start_time) continue;
      const k = format(new Date(u.start_time), "yyyy-MM");
      const entry = monthly.get(k);
      if (entry) {
        entry.uses += 1;
        entry.discount += Number(u.discount_amount || 0);
      }
    }
    const monthlyArr = [...monthly.values()];

    return {
      total: list.length,
      active: active.length,
      expired: expired.length,
      usesInPeriod,
      discountInPeriod,
      byCouponMap: byCoupon,
      top,
      monthly: monthlyArr,
    };
  }, [coupons.data, usage.data]);

  const filtered = useMemo(() => {
    const list = coupons.data ?? [];
    const now = new Date();
    return list.filter((c) => {
      const isExpired = c.expires_at && new Date(c.expires_at) < now;
      if (status === "active" && !(c.active && !isExpired)) return false;
      if (status === "inactive" && c.active) return false;
      if (status === "expired" && !isExpired) return false;
      if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [coupons.data, status, search]);

  const formatValue = (c: Coupon) => {
    if (c.type === "percent" || c.type === "percentage") return `${Number(c.value).toFixed(0)}%`;
    return brl(Number(c.value || 0));
  };

  const statusBadge = (c: Coupon) => {
    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
    if (isExpired) return <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 border">Expirado</Badge>;
    if (!c.active) return <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 border">Inativo</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 border">Ativo</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="bg-[#0A1020] border-[rgba(255,184,0,0.15)] rounded-2xl">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="prev_month">Mês anterior</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Buscar cupom</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código do cupom…"
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={TicketPercent} label="Cupons cadastrados" value={String(stats.total)} accent="text-primary" />
        <KpiCard icon={CheckCircle2} label="Cupons ativos" value={String(stats.active)} accent="text-emerald-400" />
        <KpiCard icon={TrendingUp} label="Usos no período" value={String(stats.usesInPeriod)} accent="text-sky-400" />
        <KpiCard icon={DollarSign} label="Desconto concedido" value={brl(stats.discountInPeriod)} accent="text-amber-300" />
      </div>

      {/* Chart + Top */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-[#0A1020] border-[rgba(255,184,0,0.15)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Utilização mensal</h3>
                <p className="text-xs text-muted-foreground">Últimos 6 meses (baseado no período aplicado)</p>
              </div>
              <Percent className="h-4 w-4 text-primary" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#0A1020", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12 }}
                    formatter={(v: any, name: string) => name === "discount" ? [brl(Number(v)), "Desconto"] : [v, "Usos"]}
                  />
                  <Bar dataKey="uses" fill={GOLD} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0A1020] border-[rgba(255,184,0,0.15)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Top cupons no período</h3>
              <TicketPercent className="h-4 w-4 text-primary" />
            </div>
            {stats.top.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum uso no período.</p>
            ) : (
              <ul className="space-y-2">
                {stats.top.map((t, i) => (
                  <li key={t.code + i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-white truncate">{t.code}</div>
                      <div className="text-[11px] text-muted-foreground">{t.uses} uso{t.uses > 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-300">{brl(t.discount)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-[#0A1020] border-[rgba(255,184,0,0.15)] rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 flex items-center justify-between border-b border-white/5">
            <div>
              <h3 className="text-sm font-semibold text-white">Cupons</h3>
              <p className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum cupom encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3">Código</th>
                    <th className="text-left px-3 py-3">Tipo</th>
                    <th className="text-right px-3 py-3">Valor</th>
                    <th className="text-right px-3 py-3">Usos</th>
                    <th className="text-right px-3 py-3">Limite</th>
                    <th className="text-right px-3 py-3">Desconto no período</th>
                    <th className="text-left px-3 py-3">Validade</th>
                    <th className="text-left px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const inPeriod = stats.byCouponMap.get(c.id);
                    return (
                      <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-mono text-white">{c.code}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {c.type === "percent" || c.type === "percentage" ? "Percentual" : "Fixo"}
                        </td>
                        <td className="px-3 py-3 text-right text-white">{formatValue(c)}</td>
                        <td className="px-3 py-3 text-right text-white">{c.used_count ?? 0}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{c.usage_limit ?? "∞"}</td>
                        <td className="px-3 py-3 text-right text-amber-300">
                          {inPeriod ? brl(inPeriod.discount) : brl(0)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {c.expires_at ? format(new Date(c.expires_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-5 py-3">{statusBadge(c)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card className="bg-[#0A1020] border-[rgba(255,184,0,0.15)] rounded-2xl hover:border-[rgba(255,184,0,0.35)] transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", accent ?? "text-primary")} />
        </div>
        <div className={cn("text-2xl font-bold", accent ?? "text-white")}>{value}</div>
      </CardContent>
    </Card>
  );
}
