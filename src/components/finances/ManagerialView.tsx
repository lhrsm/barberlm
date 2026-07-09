import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import {
  Scissors, Crown, Package, TicketPercent, Coins, Wallet, DollarSign,
  TrendingUp, TrendingDown, Users, Award, Target, Percent, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "today" | "7d" | "30d" | "month" | "prev_month" | "90d" | "year" | "all";

const GOLD = "#D4AF37";
const GOLD_SOFT = "#F5D062";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const SKY = "#38bdf8";
const VIOLET = "#a78bfa";
const AMBER = "#f59e0b";
const SLATE = "#94a3b8";

const ORIGIN_COLORS = [GOLD, EMERALD, SKY, VIOLET, AMBER, ROSE, SLATE];

function periodRange(p: Period): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (p) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
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

const pct = (v: number) => `${v.toFixed(1)}%`;

export function ManagerialView({ tenantId }: { tenantId: string }) {
  const [period, setPeriod] = useState<Period>("month");
  const { start, end } = useMemo(() => periodRange(period), [period]);

  const query = useQuery({
    queryKey: ["managerial-finance", tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const startIso = start?.toISOString();
      const endIso = end?.toISOString();
      const inRange = (col: string, q: any) => {
        let x = q;
        if (startIso) x = x.gte(col, startIso);
        if (endIso) x = x.lte(col, endIso);
        return x;
      };

      const [
        apptsRes,
        productsRes,
        subPaymentsRes,
        cashbackRes,
        creditsRes,
        couponsRes,
      ] = await Promise.all([
        inRange(
          "start_time",
          supabase
            .from("appointments")
            .select(
              "id, start_time, status, payment_method, total_price, final_amount, original_total, discount_amount, subscription_covered_amount, cashback_used, cashback_earned, credits_used, credit_used, service_amount, coupon_id, barber_id, service_id, services(name), barber:barbers(name)",
            )
            .eq("tenant_id", tenantId),
        ),
        inRange(
          "created_at",
          supabase
            .from("product_sales")
            .select("id, created_at, total_amount, status, items")
            .eq("tenant_id", tenantId),
        ),
        inRange(
          "paid_at",
          supabase
            .from("subscription_payments")
            .select("id, paid_at, amount, status")
            .eq("tenant_id", tenantId)
            .eq("status", "paid"),
        ),
        inRange(
          "created_at",
          supabase
            .from("cashback_transactions")
            .select("id, created_at, amount, type")
            .eq("tenant_id", tenantId),
        ),
        inRange(
          "created_at",
          supabase
            .from("credit_transactions")
            .select("id, created_at, amount, type")
            .eq("tenant_id", tenantId),
        ),
        supabase
          .from("coupons")
          .select("id, code, value, type, used_count, usage_limit, active")
          .eq("tenant_id", tenantId),
      ]);

      return {
        appointments: apptsRes.data || [],
        products: productsRes.data || [],
        subPayments: subPaymentsRes.data || [],
        cashback: cashbackRes.data || [],
        credits: creditsRes.data || [],
        coupons: couponsRes.data || [],
      };
    },
  });

  const derived = useMemo(() => {
    const d = query.data;
    if (!d) return null;

    const completed = d.appointments.filter((a: any) => a.status === "completed");

    // ---- Origem das Receitas ----
    let receitaAvulsa = 0;
    let receitaCreditos = 0;
    let receitaCashback = 0;
    let receitaAposCupons = 0; // net após desconto (serviços)
    let descontoCupons = 0;
    let economiaAssinaturas = 0;

    completed.forEach((a: any) => {
      const total = Number(a.final_amount || a.total_price || 0);
      const covered = Number(a.subscription_covered_amount || 0);
      const cashUsed = Number(a.cashback_used || 0);
      const credUsed = Number(a.credits_used || a.credit_used || 0);
      const discount = Number(a.discount_amount || 0);
      const avulsa = Math.max(0, total - covered - cashUsed - credUsed);
      receitaAvulsa += avulsa;
      receitaCashback += cashUsed;
      receitaCreditos += credUsed;
      if (a.coupon_id) {
        descontoCupons += discount;
        receitaAposCupons += total;
      }
      economiaAssinaturas += covered;
    });

    const receitaAssinaturas = d.subPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const receitaProdutos = d.products
      .filter((p: any) => p.status !== "refunded")
      .reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);

    const receitaTotal = receitaAvulsa + receitaAssinaturas + receitaProdutos;

    // ---- Benefícios concedidos ----
    const cashbackConcedido = d.cashback
      .filter((c: any) => c.type === "earned" || Number(c.amount) > 0)
      .reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
    const cashbackUtilizado = d.cashback
      .filter((c: any) => c.type === "used" || Number(c.amount) < 0)
      .reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
    const creditosConcedidos = d.credits
      .filter((c: any) => ["earned", "credit", "purchase", "grant"].includes(c.type) || Number(c.amount) > 0)
      .reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
    const creditosUtilizados = d.credits
      .filter((c: any) => ["used", "debit", "spend"].includes(c.type) || Number(c.amount) < 0)
      .reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);

    // ---- KPIs ----
    const ticketMedio = completed.length ? receitaAvulsa / completed.length : 0;
    const receitaBruta =
      completed.reduce((s: number, a: any) => s + Number(a.original_total || a.total_price || a.final_amount || 0), 0) +
      receitaAssinaturas + receitaProdutos;
    const descontosTotais = descontoCupons + cashbackUtilizado + creditosUtilizados;
    const receitaLiquida = receitaTotal;

    // ---- Rankings ----
    const byBarber = new Map<string, { name: string; value: number; count: number }>();
    const byService = new Map<string, { name: string; value: number; count: number }>();
    completed.forEach((a: any) => {
      const total = Number(a.final_amount || a.total_price || 0);
      const bId = a.barber_id || "—";
      const bName = a.barber?.name || "Sem barbeiro";
      const bPrev = byBarber.get(bId) || { name: bName, value: 0, count: 0 };
      byBarber.set(bId, { name: bName, value: bPrev.value + total, count: bPrev.count + 1 });

      const sId = a.service_id || "—";
      const sName = a.services?.name || "Serviço";
      const sPrev = byService.get(sId) || { name: sName, value: 0, count: 0 };
      byService.set(sId, { name: sName, value: sPrev.value + total, count: sPrev.count + 1 });
    });

    const topBarbers = Array.from(byBarber.values()).sort((a, b) => b.value - a.value);
    const topServices = Array.from(byService.values()).sort((a, b) => b.value - a.value);

    // ---- Receita por Pagamento ----
    const byPayment = new Map<string, number>();
    completed.forEach((a: any) => {
      const m = a.payment_method || "outros";
      byPayment.set(m, (byPayment.get(m) || 0) + Number(a.final_amount || a.total_price || 0));
    });
    const paymentData = Array.from(byPayment.entries()).map(([k, v]) => ({
      name: k === "pix" ? "PIX" : k === "cash" ? "Dinheiro" : k === "credit_card" ? "Cartão" : k === "mixed" ? "Misto" : k === "subscription" ? "Assinatura" : k.toUpperCase(),
      value: v,
    }));

    // ---- Receita Mensal (últimos 6 meses) ----
    const monthly: Record<string, { month: string; receita: number; cupons: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      monthly[key] = { month: format(d, "MMM/yy", { locale: ptBR }), receita: 0, cupons: 0 };
    }
    completed.forEach((a: any) => {
      const key = format(new Date(a.start_time), "yyyy-MM");
      if (monthly[key]) {
        monthly[key].receita += Number(a.final_amount || a.total_price || 0);
        if (a.coupon_id) monthly[key].cupons += 1;
      }
    });
    const monthlyData = Object.values(monthly);

    // ---- Cupom top / Cupons stats ----
    const couponUsageMap = new Map<string, number>();
    completed.forEach((a: any) => {
      if (a.coupon_id) couponUsageMap.set(a.coupon_id, (couponUsageMap.get(a.coupon_id) || 0) + 1);
    });
    const cupomMaisUtilizado =
      d.coupons
        .map((c: any) => ({ code: c.code, uses: couponUsageMap.get(c.id) || 0 }))
        .sort((a, b) => b.uses - a.uses)[0]?.code || "—";

    // ---- Origem para pizza ----
    const origemData = [
      { name: "Serviços Avulsos", value: receitaAvulsa },
      { name: "Assinaturas", value: receitaAssinaturas },
      { name: "Produtos", value: receitaProdutos },
      { name: "Créditos", value: receitaCreditos },
      { name: "Cashback", value: receitaCashback },
    ].filter((x) => x.value > 0);

    return {
      receitaAvulsa, receitaAssinaturas, receitaProdutos, receitaCreditos, receitaCashback,
      receitaAposCupons, receitaTotal, descontoCupons, economiaAssinaturas,
      cashbackConcedido, cashbackUtilizado, creditosConcedidos, creditosUtilizados,
      ticketMedio, receitaBruta, receitaLiquida, descontosTotais,
      topBarbers, topServices, paymentData, monthlyData, origemData,
      cupomMaisUtilizado,
      completedCount: completed.length,
    };
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-11 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const d = derived!;

  return (
    <div className="space-y-6 pt-4">
      {/* Header + Period filter */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Inteligência financeira</p>
          <h3 className="text-xl md:text-2xl font-black text-foreground mt-1">Visão Gerencial</h3>
          <p className="text-xs text-muted-foreground">De onde vem sua receita e para onde vão seus benefícios.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px] h-10 rounded-[12px] border-[#D4AF37]/40 bg-white text-[#B8860B] font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="prev_month">Mês anterior</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Origem das Receitas */}
      <SectionTitle
        eyebrow="Origem das Receitas"
        title="De onde vem seu faturamento"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard icon={Scissors} label="Receita Avulsa" value={brl(d.receitaAvulsa)} accent="gold" />
        <KpiCard icon={Crown} label="Receita Assinaturas" value={brl(d.receitaAssinaturas)} accent="gold" />
        <KpiCard icon={Package} label="Receita Produtos" value={brl(d.receitaProdutos)} accent="sky" />
        <KpiCard icon={TicketPercent} label="Receita após Cupons" value={brl(d.receitaAposCupons)} accent="emerald" />
        <KpiCard icon={Coins} label="Receita via Créditos" value={brl(d.receitaCreditos)} accent="violet" />
        <KpiCard icon={Wallet} label="Receita via Cashback" value={brl(d.receitaCashback)} accent="amber" />
        <KpiCard icon={DollarSign} label="Receita Total" value={brl(d.receitaTotal)} accent="gold" highlight />
        <KpiCard icon={Target} label="Ticket Médio" value={brl(d.ticketMedio)} accent="slate" />
      </div>

      {/* Pizza + Pagamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribuição por Origem" subtitle="Peso de cada fonte de receita">
          {d.origemData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={d.origemData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {d.origemData.map((_, i) => <Cell key={i} fill={ORIGIN_COLORS[i % ORIGIN_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Receita por Forma de Pagamento" subtitle="PIX, Cartão, Dinheiro e mais">
          {d.paymentData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.paymentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke={SLATE} fontSize={11} />
                <YAxis stroke={SLATE} fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 100) / 10}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="value" fill={GOLD} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* Benefícios Concedidos */}
      <SectionTitle eyebrow="Benefícios Concedidos" title="Descontos, cashback, créditos e assinaturas" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Wallet} label="Cashback Concedido" value={brl(d.cashbackConcedido)} accent="amber" />
        <KpiCard icon={TrendingDown} label="Cashback Utilizado" value={brl(d.cashbackUtilizado)} accent="rose" />
        <KpiCard icon={Coins} label="Créditos Concedidos" value={brl(d.creditosConcedidos)} accent="violet" />
        <KpiCard icon={TrendingDown} label="Créditos Utilizados" value={brl(d.creditosUtilizados)} accent="rose" />
        <KpiCard icon={TicketPercent} label="Descontos por Cupom" value={brl(d.descontoCupons)} accent="emerald" />
        <KpiCard icon={Crown} label="Economia via Assinaturas" value={brl(d.economiaAssinaturas)} accent="gold" />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Receita Mensal" subtitle="Últimos 6 meses">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke={SLATE} fontSize={11} />
              <YAxis stroke={SLATE} fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 100) / 10}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
              <Line type="monotone" dataKey="receita" stroke={GOLD} strokeWidth={3} dot={{ fill: GOLD, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cupons Utilizados por Mês" subtitle="Frequência de resgate">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke={SLATE} fontSize={11} />
              <YAxis stroke={SLATE} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cupons" fill={EMERALD} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Receita por Profissional" subtitle="Top performers">
          {d.topBarbers.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, d.topBarbers.length * 42)}>
              <BarChart data={d.topBarbers.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 100) / 10}k`} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={11} width={100} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="value" fill={VIOLET} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Receita por Serviço" subtitle="Mais rentáveis">
          {d.topServices.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, Math.min(d.topServices.length, 8) * 42)}>
              <BarChart data={d.topServices.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickFormatter={(v) => `R$${Math.round(v / 100) / 10}k`} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={11} width={100} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="value" fill={SKY} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* KPIs Gerenciais */}
      <SectionTitle eyebrow="KPIs Gerenciais" title="Indicadores executivos" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Receita Bruta" value={brl(d.receitaBruta)} accent="emerald" />
        <KpiCard icon={DollarSign} label="Receita Líquida" value={brl(d.receitaLiquida)} accent="gold" />
        <KpiCard icon={Percent} label="Descontos Totais" value={brl(d.descontosTotais)} accent="rose" />
        <KpiCard icon={Target} label="Ticket Médio" value={brl(d.ticketMedio)} accent="sky" />
        <KpiCard icon={Award} label="Profissional Top" value={d.topBarbers[0]?.name || "—"} hint={d.topBarbers[0] ? brl(d.topBarbers[0].value) : ""} accent="violet" />
        <KpiCard icon={Sparkles} label="Serviço Mais Vendido" value={d.topServices[0]?.name || "—"} hint={d.topServices[0] ? `${d.topServices[0].count} atendimentos` : ""} accent="amber" />
        <KpiCard icon={TicketPercent} label="Cupom Mais Utilizado" value={d.cupomMaisUtilizado} accent="emerald" />
        <KpiCard icon={Users} label="Atendimentos" value={String(d.completedCount)} hint="concluídos no período" accent="slate" />
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="pt-2">
      <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">{eyebrow}</p>
      <h4 className="text-base md:text-lg font-black text-foreground mt-1">{title}</h4>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, hint, accent = "slate", highlight,
}: {
  icon: any; label: string; value: string; hint?: string;
  accent?: "gold" | "emerald" | "sky" | "violet" | "amber" | "rose" | "slate";
  highlight?: boolean;
}) {
  const tone: Record<string, string> = {
    gold: "text-[#D4AF37] bg-[#D4AF37]/12",
    emerald: "text-emerald-500 bg-emerald-500/12",
    sky: "text-sky-500 bg-sky-500/12",
    violet: "text-violet-500 bg-violet-500/12",
    amber: "text-amber-500 bg-amber-500/12",
    rose: "text-rose-500 bg-rose-500/12",
    slate: "text-slate-400 bg-slate-400/12",
  };
  return (
    <Card
      className={cn(
        "rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.5)]",
        highlight
          ? "border-[#D4AF37]/60 bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-transparent shadow-[0_8px_28px_-14px_rgba(212,175,55,0.5)]"
          : "border-border bg-card/60 backdrop-blur",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("h-8 w-8 rounded-xl grid place-items-center", tone[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-base md:text-lg font-black truncate", highlight ? "text-[#D4AF37]" : "text-foreground")}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border border-border bg-card/60 backdrop-blur">
      <CardContent className="p-4 md:p-5">
        <div className="mb-3">
          <p className="text-sm font-bold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="h-[240px] grid place-items-center text-xs text-muted-foreground">
      Sem dados no período selecionado.
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.95)",
  border: "1px solid rgba(212,175,55,0.4)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};
