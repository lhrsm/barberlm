import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BadgePercent,
  BarChart3,
  CalendarDays,
  Coins,
  CreditCard,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Lightbulb,
  Package,
  PiggyBank,
  Printer,
  Receipt,
  Scissors,
  Sparkles,
  TicketPercent,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ErpMetricCard,
  ErpSection,
  ErpSkeletonGrid,
  MiniStat,
  RankingList,
  CHART_COLORS,
  GOLD,
  EMERALD,
  ROSE,
} from "./ui";
import {
  breakdowns,
  brl,
  buildInsights,
  computeDre,
  computeKpis,
  computeTotals,
  dailySeries,
  downloadFile,
  forecast,
  healthScore,
  highlights,
  monthlySeries,
  pct,
  toCsv,
  variation,
} from "./engine";
import { erpPeriodRange, previousRange, useErpFinance, type ErpPeriod } from "./useErpFinance";
import { ErpFinancialCalendar } from "./ErpFinancialCalendar";

const PERIODS: { value: ErpPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "prev_month", label: "Mês anterior" },
  { value: "90d", label: "90 dias" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
  { value: "custom", label: "Personalizado" },
];

const chartAxis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11 };

function ChartTooltipStyle() {
  return {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 12,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(var(--foreground))", fontWeight: 700 },
  } as any;
}

export function ErpCenter({ tenantId }: { tenantId: string }) {
  const [period, setPeriod] = useState<ErpPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [tab, setTab] = useState("receitas");


  const range = useMemo(() => erpPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  const data = useErpFinance(tenantId, range);
  const prev = useErpFinance(tenantId, prevRange, !!prevRange.start);

  const totals = useMemo(() => computeTotals(data), [data]);
  const prevTotals = useMemo(() => (prevRange.start ? computeTotals(prev) : null), [prev, prevRange.start]);
  const bd = useMemo(() => breakdowns(data), [data]);
  const series = useMemo(() => dailySeries(data.transactions, range), [data.transactions, range]);
  const months = useMemo(() => monthlySeries(data.transactions), [data.transactions]);
  const dre = useMemo(() => computeDre(totals), [totals]);
  const insights = useMemo(() => buildInsights({ totals, previous: prevTotals, bd }), [totals, prevTotals, bd]);
  const fc = useMemo(() => forecast(series, range), [series, range]);
  const spotlights = useMemo(() => highlights({ bd, series, totals }), [bd, series, totals]);

  const barbersCount = bd.byBarber.length;
  const kpis = useMemo(
    () => computeKpis(totals, { appointments: data.appointments, barbersCount }),
    [totals, data.appointments, barbersCount],
  );

  const pendingPayments = data.appointments
    .filter((a) => a.payment_status === "pending" && a.status !== "cancelled")
    .reduce((a, x) => a + (Number(x.final_amount) || Number(x.total_price) || 0), 0);

  const activeSubs = data.subscriptions.filter((s) => s.status === "active").length;
  const customersInPeriod = new Set(data.appointments.map((a) => a.customer_id).filter(Boolean)).size;

  const health = useMemo(
    () =>
      healthScore({
        totals,
        previous: prevTotals,
        pendingPayments,
        activeSubscriptions: activeSubs,
        totalCustomers: customersInPeriod || activeSubs,
      }),
    [totals, prevTotals, pendingPayments, activeSubs, customersInPeriod],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayIncome = data.transactions
    .filter((t) => t.type === "income" && String(t.date).slice(0, 10) === todayKey)
    .reduce((a, t) => a + (Number(t.amount) || 0), 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekIncome = data.transactions
    .filter((t) => t.type === "income" && new Date(String(t.date) + "T00:00:00") >= weekStart)
    .reduce((a, t) => a + (Number(t.amount) || 0), 0);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Barbex — Relatório Financeiro", range.label],
      [],
      ["Indicador", "Valor"],
      ["Receita bruta", dre.grossRevenue.toFixed(2)],
      ["Descontos", dre.discounts.toFixed(2)],
      ["Cashback concedido", dre.cashbackGranted.toFixed(2)],
      ["Créditos utilizados", dre.creditsUsed.toFixed(2)],
      ["Receita líquida", dre.netRevenue.toFixed(2)],
      ["Custos (comissões)", dre.costs.toFixed(2)],
      ["Despesas", dre.expenses.toFixed(2)],
      ["Lucro operacional", dre.operatingProfit.toFixed(2)],
      ["Lucro líquido", dre.netProfit.toFixed(2)],
      ["Ticket médio", totals.ticketAverage.toFixed(2)],
      ["Atendimentos concluídos", totals.servedCount],
      [],
      ["Data", "Entradas", "Saídas", "Saldo"],
      ...series.map((s) => [s.date, s.income.toFixed(2), s.expense.toFixed(2), s.balance.toFixed(2)]),
    ];
    downloadFile(toCsv(rows), `barbex-financeiro-${range.label}.csv`, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const rows: (string | number)[][] = [
      ["Data", "Tipo", "Categoria", "Descrição", "Profissional", "Forma de pagamento", "Valor"],
      ...data.transactions.map((t) => [
        String(t.date || "").slice(0, 10),
        t.type,
        t.category || "",
        t.description || "",
        t.barber?.name || "",
        t.payment_method || "",
        (Number(t.amount) || 0).toFixed(2),
      ]),
    ];
    downloadFile(toCsv(rows), `barbex-lancamentos-${range.label}.xls`, "application/vnd.ms-excel");
  }

  const loading = data.isLoading;

  return (
    <div className="space-y-5">
      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            aria-pressed={period === p.value}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              period === p.value
                ? "bg-gold text-black shadow-[0_10px_20px_-10px_rgba(212,175,55,0.5)]"
                : "border-transparent text-white/40 hover:bg-white/5 hover:text-white/80",
            )}
          >

            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Data inicial"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 w-[150px] text-xs"
            />
            <Input
              type="date"
              aria-label="Data final"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 w-[150px] text-xs"
            />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white" onClick={exportExcel}>
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Imp
          </Button>

        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-[#0b0f17] p-5 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div className="animate-in fade-in slide-in-from-left duration-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0b0f17]">
                    <Sparkles className="text-gold" size={20} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Barbex Financial Center Premium</p>
                  <h2 className="text-2xl font-black text-white md:text-3xl">Central Financeira</h2>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/55">{range.label} · dados consolidados do módulo financeiro</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Saldo do período" value={brl(totals.result)} detail={totals.result >= 0 ? "Positivo" : "Negativo"} />
              <MiniStat label="Receita de hoje" value={brl(todayIncome)} />
              <MiniStat label="Receita 7 dias" value={brl(weekIncome)} />
              <MiniStat label="Lucro estimado" value={brl(dre.netProfit)} detail={pct(dre.margin)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Entradas" value={brl(totals.income)} />
              <MiniStat label="Saídas" value={brl(totals.expense)} />
              <MiniStat label="Comissões" value={brl(totals.commissionsTotal)} detail={`${brl(totals.commissionsPending)} pendentes`} />
              <MiniStat
                label="vs período anterior"
                value={
                  prevTotals
                    ? `${(variation(totals.income, prevTotals.income) ?? 0) >= 0 ? "+" : ""}${(variation(totals.income, prevTotals.income) ?? 0).toFixed(1)}%`
                    : "—"
                }
                detail={prevTotals ? brl(prevTotals.income) : "Sem base"}
              />
            </div>
          </div>

          {/* Saúde financeira */}
          <div className="rounded-2xl border border-[rgba(212,175,55,0.25)] bg-black/25 p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-white">Saúde financeira da barbearia</h3>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-4xl font-black text-[#F5D062]">{health.score}</span>
              <span className="pb-1 text-xs uppercase tracking-wide text-white/70">/100 · {health.level}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D062] transition-all duration-700"
                style={{ width: `${health.score}%` }}
              />
            </div>
            <ul className="mt-3 space-y-1.5">
              {health.criteria.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-2 text-[11px] text-white/70">
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 font-semibold text-white/90">
                    {c.points}/{c.max} · {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Cards executivos */}
      {loading ? (
        <ErpSkeletonGrid count={8} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ErpMetricCard
            label="Receitas"
            value={brl(totals.income)}
            icon={TrendingUp}
            tone="positive"
            variation={prevTotals ? variation(totals.income, prevTotals.income) : null}
            hint="Soma de todos os lançamentos de entrada no período."
          />
          <ErpMetricCard
            label="Despesas"
            value={brl(totals.expense)}
            icon={TrendingDown}
            tone="negative"
            variation={prevTotals ? variation(totals.expense, prevTotals.expense) : null}
            hint="Soma dos lançamentos de saída no período."
          />
          <ErpMetricCard
            label="Lucro"
            value={brl(dre.netProfit)}
            icon={PiggyBank}
            tone="gold"
            variation={prevTotals ? variation(dre.netProfit, computeDre(prevTotals).netProfit) : null}
            hint="Receita líquida menos custos, despesas e cashback concedido."
          />
          <ErpMetricCard
            label="Fluxo de caixa"
            value={brl(totals.result)}
            icon={Wallet}
            tone={totals.result >= 0 ? "positive" : "negative"}
            variation={prevTotals ? variation(totals.result, prevTotals.result) : null}
            hint="Entradas menos saídas registradas no período."
          />
          <ErpMetricCard
            label="Ticket médio"
            value={brl(totals.ticketAverage)}
            icon={Receipt}
            variation={prevTotals ? variation(totals.ticketAverage, prevTotals.ticketAverage) : null}
            hint="Receita de serviços dividida pelos atendimentos concluídos."
            footer={`${totals.servedCount} atendimentos`}
          />
          <ErpMetricCard
            label="Receita por serviço"
            value={brl(totals.servicesRevenue)}
            icon={Scissors}
            hint="Valor total dos atendimentos concluídos, excluindo produtos."
            footer={bd.byService[0]?.name}
          />
          <ErpMetricCard
            label="Receita por profissional"
            value={brl(bd.byBarber.reduce((a, b) => a + b.value, 0))}
            icon={Users}
            hint="Entradas vinculadas a profissionais."
            footer={bd.byBarber[0] ? `Top: ${bd.byBarber[0].name}` : undefined}
          />
          <ErpMetricCard
            label="Receita por produto"
            value={brl(totals.productsRevenue)}
            icon={Package}
            hint="Vendas de produtos concluídas no período."
            footer={bd.byProduct[0]?.name}
          />
          <ErpMetricCard
            label="Cashback concedido"
            value={brl(totals.cashbackGranted)}
            icon={Coins}
            hint="Cashback gerado para clientes no período."
            footer={`${brl(totals.cashbackUsed)} utilizados`}
          />
          <ErpMetricCard
            label="Créditos utilizados"
            value={brl(totals.creditsUsed)}
            icon={CreditCard}
            hint="Créditos consumidos pelos clientes."
            footer={`${brl(totals.creditsGranted)} concedidos`}
          />
          <ErpMetricCard
            label="Cupons utilizados"
            value={String(totals.couponsUsed)}
            icon={TicketPercent}
            hint="Atendimentos concluídos com cupom aplicado."
            footer={`${brl(totals.couponsDiscount)} em descontos`}
          />
          <ErpMetricCard
            label="Assinaturas ativas"
            value={String(activeSubs)}
            icon={Crown}
            tone="gold"
            hint="Assinaturas com status ativo."
            footer={`${brl(totals.subscriptionsRevenue)} recorrentes`}
          />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-1 mb-8 overflow-x-auto no-scrollbar">
          {[
            { v: "receitas", label: "Receitas", icon: TrendingUp },
            { v: "despesas", label: "Despesas", icon: TrendingDown },
            { v: "fluxo", label: "Fluxo de Caixa", icon: Activity },
            { v: "dre", label: "DRE", icon: FileText },
            { v: "indicadores", label: "Indicadores", icon: BarChart3 },
            { v: "beneficios", label: "Benefícios", icon: BadgePercent },
            { v: "calendario", label: "Calendário", icon: CalendarDays },
            { v: "resumo", label: "Insights", icon: Sparkles },
          ].map(({ v, label, icon: Icon }) => (
            <TabsTrigger 
              key={v} 
              value={v} 
              className="gap-1.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-gold data-[state=active]:text-black hover:text-white/80"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}

        </TabsList>

        {/* Inteligência */}
        <TabsContent value="resumo" className="space-y-4 pt-4">
          <ErpSection title="Centro Financeiro Inteligente" description="Destaques automáticos do período" icon={Sparkles}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {spotlights.map((s) => (
                <MiniStat key={s.label} label={s.label} value={s.value} detail={s.detail} />
              ))}
            </div>
          </ErpSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ErpSection title="Análises automáticas" description="Leitura objetiva dos números" icon={Lightbulb}>
              {insights.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sem dados suficientes no período.</p>
              ) : (
                <ul className="space-y-2">
                  {insights.map((i, idx) => (
                    <li
                      key={idx}
                      className={cn(
                        "rounded-xl border-l-4 bg-background/40 p-3 transition-colors",
                        i.tone === "positive"
                          ? "border-l-emerald-500"
                          : i.tone === "negative"
                            ? "border-l-rose-500"
                            : "border-l-[#D4AF37]",
                      )}
                    >
                      <p className="text-sm font-bold text-foreground">{i.title}</p>
                      <p className="text-xs text-muted-foreground">{i.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </ErpSection>

            <ErpSection title="Previsão financeira" description="Projeção linear pelo ritmo atual (sem IA)" icon={TrendingUp}>
              {!fc ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sem movimentações para projetar.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Mantendo o ritmo atual de <strong className="text-foreground">{brl(fc.dailyIncome)}/dia</strong>, faltando{" "}
                    {fc.remainingDays} dia(s) para fechar o mês:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Receita prevista" value={brl(fc.projectedIncome)} />
                    <MiniStat label="Despesa prevista" value={brl(fc.projectedExpense)} />
                    <MiniStat label="Resultado previsto" value={brl(fc.projectedResult)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Estimativa calculada apenas com o histórico do período selecionado.
                  </p>
                </div>
              )}
            </ErpSection>
          </div>
        </TabsContent>

        {/* Fluxo de caixa */}
        <TabsContent value="fluxo" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ErpMetricCard label="Entradas" value={brl(totals.income)} icon={TrendingUp} tone="positive" />
            <ErpMetricCard label="Saídas" value={brl(totals.expense)} icon={TrendingDown} tone="negative" />
            <ErpMetricCard
              label="Saldo do período"
              value={brl(totals.result)}
              icon={Wallet}
              tone={totals.result >= 0 ? "positive" : "negative"}
            />
            <ErpMetricCard
              label="Saldo acumulado"
              value={brl(series.length ? series[series.length - 1].accumulated : 0)}
              icon={PiggyBank}
              tone="gold"
            />
          </div>

          <ErpSection title="Evolução diária" description="Entradas, saídas e saldo acumulado" icon={Activity}>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="erpIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={EMERALD} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="erpOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ROSE} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={ROSE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" name="Entradas" stroke={EMERALD} fill="url(#erpIn)" />
                  <Area type="monotone" dataKey="expense" name="Saídas" stroke={ROSE} fill="url(#erpOut)" />
                  <Line type="monotone" dataKey="accumulated" name="Acumulado" stroke={GOLD} dot={false} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ErpSection>

          <ErpSection title="Evolução mensal" description="Histórico consolidado por mês" icon={BarChart3}>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Entradas" fill={EMERALD} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Saídas" fill={ROSE} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="balance" name="Saldo" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ErpSection>
        </TabsContent>

        {/* Receitas */}
        <TabsContent value="receitas" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ErpSection title="Receita por profissional" icon={Users}>
              <RankingList items={bd.byBarber.slice(0, 10)} />
            </ErpSection>
            <ErpSection title="Receita por serviço" icon={Scissors}>
              <RankingList items={bd.byService.slice(0, 10)} />
            </ErpSection>
            <ErpSection title="Receita por produto" icon={Package}>
              <RankingList items={bd.byProduct.slice(0, 10)} emptyLabel="Nenhum produto vendido no período" />
            </ErpSection>
            <ErpSection title="Receita por origem" description="Walk-in, online e manual" icon={Activity}>
              <RankingList items={bd.byOrigin.slice(0, 10)} />
            </ErpSection>
          </div>

          <ErpSection title="Receita por forma de pagamento" icon={CreditCard}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bd.byPayment} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                      {bd.byPayment.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <RankingList items={bd.byPayment} />
            </div>
          </ErpSection>
        </TabsContent>

        {/* Despesas */}
        <TabsContent value="despesas" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ErpMetricCard label="Total de saídas" value={brl(totals.expense)} icon={TrendingDown} tone="negative" />
            <ErpMetricCard label="Categorias" value={String(bd.byCategory.length)} icon={BarChart3} />
            <ErpMetricCard
              label="Maior categoria"
              value={bd.byCategory[0]?.name || "—"}
              icon={Receipt}
              footer={bd.byCategory[0] ? brl(bd.byCategory[0].value) : undefined}
            />
          </div>
          <ErpSection title="Despesas por categoria" description="Centro de custo derivado das categorias existentes" icon={Receipt}>
            <div className="grid gap-4 lg:grid-cols-2">
              <RankingList items={bd.byCategory} emptyLabel="Nenhuma despesa lançada no período" />
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bd.byCategory.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" {...chartAxis} />
                    <YAxis type="category" dataKey="name" width={110} {...chartAxis} />
                    <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                    <Bar dataKey="value" name="Despesa" fill={ROSE} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ErpSection>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre" className="space-y-4 pt-4">
          <ErpSection
            title="DRE simplificada"
            description={`Demonstração de resultado — ${range.label}`}
            icon={FileText}
            actions={
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Exportar
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Receita bruta", dre.grossRevenue, false, true],
                    ["(-) Descontos", -dre.discounts, true, false],
                    ["(-) Cashback concedido", -dre.cashbackGranted, true, false],
                    ["(-) Créditos utilizados", -dre.creditsUsed, true, false],
                    ["(=) Receita líquida", dre.netRevenue, false, true],
                    ["(-) Custos (comissões)", -dre.costs, true, false],
                    ["(-) Despesas operacionais", -dre.expenses, true, false],
                    ["(=) Lucro operacional", dre.operatingProfit, false, true],
                    ["(=) Lucro líquido", dre.netProfit, false, true],
                  ].map(([label, value, neg, strong]: any) => (
                    <tr key={label} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className={cn("py-2.5 pr-3", strong ? "font-black text-foreground" : "text-muted-foreground")}>
                        {label}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-semibold tabular-nums",
                          strong && "text-base font-black",
                          neg ? "text-rose-500" : value >= 0 ? "text-foreground" : "text-rose-500",
                        )}
                      >
                        {brl(value)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2.5 text-muted-foreground">Margem líquida</td>
                    <td className="py-2.5 text-right font-bold text-[#D4AF37]">{pct(dre.margin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ErpSection>

          <ErpSection title="Comissões" description="Somente visualização — cálculos preservados" icon={Users}>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Previstas" value={brl(totals.commissionsTotal)} />
              <MiniStat label="Pagas" value={brl(totals.commissionsPaid)} />
              <MiniStat label="Pendentes" value={brl(totals.commissionsPending)} />
            </div>
            <div className="mt-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bd.byBarber.slice(0, 8).map((b) => ({
                    name: b.name,
                    receita: b.value,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                  <Bar dataKey="receita" name="Receita gerada" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ErpSection>
        </TabsContent>

        {/* Indicadores */}
        <TabsContent value="indicadores" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <ErpMetricCard key={k.key} label={k.label} value={k.value} hint={k.hint} icon={Gauge} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ErpSection title="Receita por dia da semana" icon={CalendarDays}>
              <RankingList items={bd.byWeekday} />
            </ErpSection>
            <ErpSection title="Receita por horário" icon={Activity}>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bd.byHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                    <Line type="monotone" dataKey="value" name="Receita" stroke={GOLD} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ErpSection>
          </div>
        </TabsContent>

        {/* Benefícios: cashback, créditos, cupons, assinaturas */}
        <TabsContent value="beneficios" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ErpSection title="Cashback" description="Concedido, utilizado e saldo do período" icon={Coins}>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Concedido" value={brl(totals.cashbackGranted)} />
                <MiniStat label="Utilizado" value={brl(totals.cashbackUsed)} />
                <MiniStat label="Saldo gerado" value={brl(totals.cashbackGranted - totals.cashbackUsed)} />
              </div>
              <div className="mt-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Concedido", value: totals.cashbackGranted },
                      { name: "Utilizado", value: totals.cashbackUsed },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <RTooltip formatter={(v: any) => brl(Number(v))} {...ChartTooltipStyle()} />
                    <Bar dataKey="value" name="Cashback" fill={GOLD} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {data.cashback.length} movimentação(ões) de cashback registradas.
              </p>
            </ErpSection>

            <ErpSection title="Créditos" description="Concedidos, utilizados e origem" icon={CreditCard}>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Concedidos" value={brl(totals.creditsGranted)} />
                <MiniStat label="Utilizados" value={brl(totals.creditsUsed)} />
                <MiniStat label="Saldo do período" value={brl(totals.creditsGranted - totals.creditsUsed)} />
              </div>
              <ul className="mt-3 max-h-[220px] space-y-1.5 overflow-y-auto">
                {data.credits.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-3 py-2 text-xs">
                    <span className="truncate text-muted-foreground">{c.description || c.type}</span>
                    <span className={cn("font-bold tabular-nums", Number(c.amount) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {brl(Number(c.amount))}
                    </span>
                  </li>
                ))}
                {data.credits.length === 0 && (
                  <li className="py-4 text-center text-sm text-muted-foreground">Nenhum crédito no período</li>
                )}
              </ul>
            </ErpSection>

            <ErpSection title="Cupons" description="Uso e impacto no período" icon={TicketPercent}>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Utilizações" value={String(totals.couponsUsed)} />
                <MiniStat label="Descontos" value={brl(totals.couponsDiscount)} />
                <MiniStat
                  label="Ativos"
                  value={String(data.coupons.filter((c) => c.active).length)}
                  detail={`${data.coupons.filter((c) => !c.active || (c.expires_at && new Date(c.expires_at) < new Date())).length} expirados/inativos`}
                />
              </div>
              <ul className="mt-3 max-h-[220px] space-y-1.5 overflow-y-auto">
                {[...data.coupons]
                  .sort((a, b) => (b.used_count || 0) - (a.used_count || 0))
                  .slice(0, 10)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">{c.code}</span>
                      <span className="text-muted-foreground">
                        {c.used_count || 0} uso(s) · {c.type === "percent" ? `${c.value}%` : brl(Number(c.value))}
                      </span>
                    </li>
                  ))}
                {data.coupons.length === 0 && (
                  <li className="py-4 text-center text-sm text-muted-foreground">Nenhum cupom cadastrado</li>
                )}
              </ul>
            </ErpSection>

            <ErpSection title="Assinaturas" description="Receita recorrente e movimentações" icon={Crown}>
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Receita recorrente" value={brl(totals.subscriptionsRevenue)} detail="Assinaturas ativas" />
                <MiniStat label="Ativas" value={String(activeSubs)} />
                <MiniStat
                  label="Canceladas"
                  value={String(data.subscriptions.filter((s) => s.status === "canceled" || s.status === "cancelled").length)}
                />
                <MiniStat
                  label="Renovações previstas"
                  value={String(
                    data.subscriptions.filter(
                      (s) => s.status === "active" && (s.next_billing_at || s.renewal_date || s.current_period_end),
                    ).length,
                  )}
                />
              </div>
            </ErpSection>
          </div>
        </TabsContent>

        {/* Calendário */}
        <TabsContent value="calendario" className="pt-4">
          <ErpSection title="Calendário financeiro" description="Entradas, saídas, previsões e renovações" icon={CalendarDays}>
            <ErpFinancialCalendar
              transactions={data.transactions}
              appointments={data.appointments}
              subscriptions={data.subscriptions}
            />
          </ErpSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
