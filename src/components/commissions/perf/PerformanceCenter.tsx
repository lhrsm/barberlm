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
  Award,
  BarChart3,
  Boxes,
  Clock,
  CircleDollarSign,
  Crown,
  Gauge,
  History,
  LineChart as LineIcon,
  Package,
  Scissors,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommissionsPerf } from "./useCommissionsPerf";
import { buildPerf, fmtBRL, type PerfBarber } from "./engine";
import {
  ChartFrame,
  MetricCard,
  MiniStat,
  Panel,
  PanelSkeleton,
  RankingList,
  SectionTitle,
} from "./ui";
import {
  BadgesPanel,
  CommissionSimulator,
  EarningsHeatmap,
  ForecastPanel,
  GoalsPanel,
} from "./PerfExtras";

const GOLD = "#D4AF37";
const PIE_COLORS = ["#D4AF37", "#10b981", "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6"];

const axis = {
  stroke: "#3f3f46",
  tick: { fill: "#71717a", fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: "#0b0f17",
    border: "1px solid #27272a",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
  },
  labelStyle: { color: "#a1a1aa" },
};

export type PerformanceCenterProps = {
  tenantId: string | null;
  barbers: PerfBarber[];
  from: string;
  to: string;
};

export default function PerformanceCenter({
  tenantId,
  barbers,
  from,
  to,
}: PerformanceCenterProps) {
  const [barberId, setBarberId] = useState("all");
  const [tab, setTab] = useState("overview");
  const { data, isLoading } = useCommissionsPerf(tenantId, from, to);

  const model = useMemo(
    () => buildPerf({ data, barbers, from, to, barberId }),
    [data, barbers, from, to, barberId],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PanelSkeleton height={140} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricCard key={i} label="" value="" loading />
          ))}
        </div>
        <PanelSkeleton />
      </div>
    );
  }

  const h = model.hero;
  const c = model.cards;
  const k = model.kpis;

  const TABS = [
    { v: "overview", label: "Visão Geral", icon: Gauge },
    { v: "charts", label: "Gráficos", icon: BarChart3 },
    { v: "timeline", label: "Linha do Tempo", icon: History },
    { v: "breakdown", label: "Serviços & Produtos", icon: Scissors },
    { v: "map", label: "Mapa de Ganhos", icon: Sparkles },
    { v: "goals", label: "Metas & Simulador", icon: Award },
    { v: "insights", label: "Insights", icon: LineIcon },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#141008] via-[#0b0f17] to-[#05070d] p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(212,175,55,0.14)" }}
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]/80">
              Painel de Produtividade
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {fmtBRL(h.commissionTotal)}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Comissão prevista no período ·{" "}
              <span className="font-bold text-emerald-400">
                {fmtBRL(h.commissionPaid)} recebida
              </span>{" "}
              ·{" "}
              <span className="font-bold text-amber-400">
                {fmtBRL(h.commissionPending)} pendente
              </span>
            </p>
          </div>
          <div className="w-full lg:w-64">
            <Select value={barberId} onValueChange={setBarberId}>
              <SelectTrigger
                aria-label="Filtrar por barbeiro"
                className="h-10 border-[#D4AF37]/25 bg-[#05070d] text-white focus:border-[#D4AF37]/60"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[#0b0f17] text-white">
                <SelectItem value="all">Todos os barbeiros</SelectItem>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Receita gerada" value={fmtBRL(h.revenue)} tone="gold" />
          <MiniStat label="Ticket médio" value={fmtBRL(h.avgTicket)} />
          <MiniStat label="Atendimentos" value={String(h.servicesCount)} />
          <MiniStat label="Produtos vendidos" value={String(h.productUnits)} />
          <MiniStat label="Receita de produtos" value={fmtBRL(h.productRevenue)} />
          <MiniStat
            label="Avaliação média"
            value={c.avgRating ? c.avgRating.toFixed(2) : "—"}
            tone="emerald"
          />
        </div>
      </div>

      {/* CARDS EXECUTIVOS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Comissão do Dia"
          value={fmtBRL(c.day)}
          icon={CircleDollarSign}
          tooltip="Soma dos lançamentos de comissão registrados hoje."
        />
        <MetricCard
          label="Comissão da Semana"
          value={fmtBRL(c.week)}
          icon={Wallet}
          accent="emerald"
          tooltip="Comissões acumuladas desde o domingo desta semana."
        />
        <MetricCard
          label="Comissão do Mês"
          value={fmtBRL(c.month)}
          icon={TrendingUp}
          accent="sky"
          delta={c.commissionDelta}
          tooltip="Comissões acumuladas no mês corrente."
        />
        <MetricCard
          label="Receita Gerada"
          value={fmtBRL(c.revenue)}
          icon={BarChart3}
          delta={c.revenueDelta}
          tooltip="Faturamento dos atendimentos concluídos no período."
        />
        <MetricCard
          label="Produtos Vendidos"
          value={fmtBRL(c.productRevenue)}
          icon={Package}
          accent="violet"
          delta={c.productDelta}
          hint={`${h.productUnits} unidades`}
          tooltip="Vendas de produtos concluídas atribuídas ao barbeiro."
        />
        <MetricCard
          label="Serviços Realizados"
          value={String(c.servicesCount)}
          icon={Scissors}
          accent="amber"
          delta={c.servicesDelta}
          tooltip="Atendimentos concluídos no período selecionado."
        />
        <MetricCard
          label="Ticket Médio"
          value={fmtBRL(c.avgTicket)}
          icon={Users}
          delta={c.avgTicketDelta}
          tooltip="Receita dividida pelo número de atendimentos concluídos."
        />
        <MetricCard
          label="Avaliação Média"
          value={c.avgRating ? `${c.avgRating.toFixed(2)} ★` : "—"}
          icon={Star}
          accent="emerald"
          hint={`${c.ratingCount} avaliação(ões)`}
          tooltip="Média das avaliações recebidas no período."
        />
      </div>

      {/* TABS */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="flex h-auto w-max min-w-full gap-1 rounded-2xl border border-zinc-800/80 bg-[#0b0f17] p-1.5">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-all hover:text-[#D4AF37] data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37] data-[state=active]:shadow-[inset_0_-2px_0_0_#D4AF37]"
              >
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartFrame
              title="Comissão diária"
              subtitle="Evolução no período selecionado"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.series.daily}>
                  <defs>
                    <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip
                    {...tooltipStyle}
                    formatter={(v: any) => fmtBRL(Number(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="commission"
                    name="Comissão"
                    stroke={GOLD}
                    fill="url(#gradGold)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>

            <Panel>
              <SectionTitle title="Indicadores" subtitle="KPIs do período" icon={Gauge} />
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <MiniStat label="Receita / atendimento" value={fmtBRL(k.revenuePerService)} />
                <MiniStat label="Receita / hora" value={fmtBRL(k.revenuePerHour)} tone="gold" />
                <MiniStat label="Receita / cliente" value={fmtBRL(k.revenuePerCustomer)} />
                <MiniStat label="Comissão média" value={fmtBRL(k.avgCommission)} tone="emerald" />
                <MiniStat label="Ticket médio" value={fmtBRL(k.avgTicket)} />
                <MiniStat
                  label="Produtos / atendimento"
                  value={k.productsPerService.toFixed(2)}
                  tone="amber"
                />
                <MiniStat label="Clientes únicos" value={String(k.uniqueCustomers)} />
                <MiniStat label="Horas atendidas" value={`${k.workedHours.toFixed(1)}h`} />
              </div>
            </Panel>
          </div>

          {model.ranking.length > 1 && (
            <Panel>
              <SectionTitle
                title="Ranking de barbeiros"
                subtitle="Comparativo do período"
                icon={Crown}
              />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { title: "Maior faturamento", key: "revenue" as const, money: true },
                  { title: "Maior comissão", key: "commission" as const, money: true },
                  { title: "Maior ticket médio", key: "avgTicket" as const, money: true },
                  { title: "Maior venda de produtos", key: "products" as const, money: true },
                  { title: "Maior avaliação", key: "rating" as const, money: false },
                  { title: "Mais atendimentos", key: "services" as const, money: false },
                ].map((cfg) => {
                  const sorted = [...model.ranking].sort(
                    (a, b) => Number(b[cfg.key]) - Number(a[cfg.key]),
                  );
                  const max = Number(sorted[0]?.[cfg.key] ?? 0) || 1;
                  return (
                    <div key={cfg.key}>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {cfg.title}
                      </p>
                      <ul className="space-y-2">
                        {sorted.slice(0, 5).map((r, i) => (
                          <li key={r.id}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate font-bold text-white">
                                {i + 1}. {r.name}
                              </span>
                              <span className="shrink-0 font-black text-[#D4AF37]">
                                {cfg.money
                                  ? fmtBRL(Number(r[cfg.key]))
                                  : cfg.key === "rating"
                                    ? Number(r.rating).toFixed(2)
                                    : String(r[cfg.key])}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-amber-300"
                                style={{
                                  width: `${Math.max(2, (Number(r[cfg.key]) / max) * 100)}%`,
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </TabsContent>

        {/* CHARTS */}
        <TabsContent value="charts" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartFrame title="Comissão semanal" subtitle="Agrupada por semana">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.series.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Bar dataKey="commission" name="Comissão" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Comissão mensal" subtitle="Últimos 12 meses">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={model.series.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                  <Line
                    type="monotone"
                    dataKey="commission"
                    name="Comissão"
                    stroke={GOLD}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Receita"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Receita gerada por dia" subtitle="Serviços concluídos">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.series.daily}>
                  <defs>
                    <linearGradient id="gradSky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Receita"
                    stroke="#38bdf8"
                    fill="url(#gradSky)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Produtos x Serviços" subtitle="Comparação mensal">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.series.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                  <Bar dataKey="products" name="Produtos (R$)" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="services" name="Serviços (qtd)" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-5 space-y-4">
          <Panel className="p-0">
            <div className="border-b border-zinc-800/80 p-4 sm:p-5">
              <SectionTitle
                title="Linha do tempo de atendimentos"
                subtitle={`${model.timeline.length} registro(s) no período`}
                icon={History}
              />
            </div>
            <div className="max-h-[560px] overflow-auto">
              {model.timeline.length === 0 ? (
                <p className="py-14 text-center text-sm text-zinc-500">
                  Nenhum atendimento concluído no período.
                </p>
              ) : (
                <ol className="divide-y divide-zinc-800/70">
                  {model.timeline.map((t) => (
                    <li
                      key={t.id}
                      className="group flex flex-col gap-2 p-4 transition-colors hover:bg-[#D4AF37]/5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                          <Clock className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {t.customer}{" "}
                            <span className="font-normal text-zinc-500">·</span>{" "}
                            <span className="font-bold text-zinc-300">{t.service}</span>
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                            {new Date(t.date).toLocaleString("pt-BR")} · {t.barber} ·{" "}
                            {t.payment}
                            {t.products > 0 && ` · produtos ${fmtBRL(t.products)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 pl-12 sm:pl-0">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Valor
                          </p>
                          <p className="text-sm font-black text-white">{fmtBRL(t.amount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Comissão
                          </p>
                          <p className="text-sm font-black text-[#D4AF37]">
                            {fmtBRL(t.commission)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>

          <Panel className="p-0">
            <div className="border-b border-zinc-800/80 p-4 sm:p-5">
              <SectionTitle title="Histórico detalhado" icon={History} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    {["Data", "Cliente", "Serviço", "Produto", "Valor", "%", "Comissão", "Status", "Pagamento"].map(
                      (hd) => (
                        <TableHead
                          key={hd}
                          className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500"
                        >
                          {hd}
                        </TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.timeline.slice(0, 200).map((t) => (
                    <TableRow key={t.id} className="border-zinc-800 hover:bg-[#D4AF37]/5">
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {new Date(t.date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-bold text-white">{t.customer}</TableCell>
                      <TableCell className="text-zinc-300">{t.service}</TableCell>
                      <TableCell className="text-zinc-300">
                        {t.products > 0 ? fmtBRL(t.products) : "—"}
                      </TableCell>
                      <TableCell className="text-zinc-300">{fmtBRL(t.amount)}</TableCell>
                      <TableCell className="text-zinc-400">
                        {t.commissionType === "percentage" && t.rate
                          ? `${Number(t.rate).toFixed(0)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-black text-[#D4AF37]">
                        {fmtBRL(t.commission)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border text-[10px] font-bold uppercase",
                            t.status === "paid"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : t.status === "partially_paid"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border-zinc-600 bg-zinc-700/20 text-zinc-400",
                          )}
                        >
                          {t.status === "paid"
                            ? "Pago"
                            : t.status === "partially_paid"
                              ? "Parcial"
                              : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-300">{t.payment}</TableCell>
                    </TableRow>
                  ))}
                  {model.timeline.length === 0 && (
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableCell colSpan={9} className="py-10 text-center text-zinc-500">
                        Sem registros no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        {/* BREAKDOWN */}
        <TabsContent value="breakdown" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel className="p-0">
              <div className="border-b border-zinc-800/80 p-4 sm:p-5">
                <SectionTitle title="Comissões por serviço" icon={Scissors} />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      {["Serviço", "Qtd", "Receita", "Comissão", "Ticket"].map((hd) => (
                        <TableHead
                          key={hd}
                          className="text-[10px] font-black uppercase tracking-widest text-zinc-500"
                        >
                          {hd}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.byService.map((s) => (
                      <TableRow key={s.name} className="border-zinc-800 hover:bg-[#D4AF37]/5">
                        <TableCell className="font-bold text-white">{s.name}</TableCell>
                        <TableCell className="text-zinc-300">{s.count}</TableCell>
                        <TableCell className="text-zinc-300">{fmtBRL(s.revenue)}</TableCell>
                        <TableCell className="font-black text-[#D4AF37]">
                          {fmtBRL(s.commission)}
                        </TableCell>
                        <TableCell className="text-zinc-300">{fmtBRL(s.avgTicket)}</TableCell>
                      </TableRow>
                    ))}
                    {model.byService.length === 0 && (
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                          Sem serviços no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Panel>

            <Panel className="p-0">
              <div className="border-b border-zinc-800/80 p-4 sm:p-5">
                <SectionTitle title="Comissões por produto" icon={Boxes} />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      {["Produto", "Unid.", "Receita", "Lucro", "Comissão"].map((hd) => (
                        <TableHead
                          key={hd}
                          className="text-[10px] font-black uppercase tracking-widest text-zinc-500"
                        >
                          {hd}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.byProduct.map((p) => (
                      <TableRow key={p.name} className="border-zinc-800 hover:bg-[#D4AF37]/5">
                        <TableCell className="font-bold text-white">{p.name}</TableCell>
                        <TableCell className="text-zinc-300">{p.units}</TableCell>
                        <TableCell className="text-zinc-300">{fmtBRL(p.revenue)}</TableCell>
                        <TableCell className="text-emerald-400">{fmtBRL(p.profit)}</TableCell>
                        <TableCell className="font-black text-[#D4AF37]">
                          {fmtBRL(p.commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {model.byProduct.length === 0 && (
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                          Sem vendas de produtos no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* MAP */}
        <TabsContent value="map" className="mt-5 space-y-4">
          <EarningsHeatmap model={model} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartFrame title="Receita por dia da semana">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.byWeekday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="name" {...axis} tickFormatter={(v) => String(v).slice(0, 3)} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Bar dataKey="revenue" name="Receita" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Receita por horário">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.byHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={48} />
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Bar dataKey="revenue" name="Receita" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Receita por forma de pagamento">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RTooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
                  <Pie
                    data={model.byPayment}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {model.byPayment.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <SectionTitle title="Receita por serviço" icon={Scissors} />
              <div className="mt-4">
                <RankingList
                  items={model.byService.slice(0, 8).map((s) => ({
                    name: s.name,
                    value: s.revenue,
                    secondary: `${s.count} atendimentos · ticket ${fmtBRL(s.avgTicket)}`,
                    ratio: s.revenue / (model.byService[0]?.revenue || 1),
                  }))}
                />
              </div>
            </Panel>
            <Panel>
              <SectionTitle title="Receita por cliente" icon={Users} />
              <div className="mt-4">
                <RankingList
                  items={model.byCustomer.map((c2) => ({
                    name: c2.name,
                    value: c2.revenue,
                    secondary: `${c2.visits} visita(s)`,
                    ratio: c2.revenue / (model.byCustomer[0]?.revenue || 1),
                  }))}
                />
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* GOALS */}
        <TabsContent value="goals" className="mt-5 space-y-4">
          <ForecastPanel model={model} />
          <GoalsPanel model={model} barbers={barbers} />
          <CommissionSimulator model={model} />
        </TabsContent>

        {/* INSIGHTS */}
        <TabsContent value="insights" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <SectionTitle
                title="Análises"
                subtitle="Comparação com o período anterior"
                icon={TrendingUp}
              />
              <div className="mt-4 space-y-2.5">
                {model.analyses.length === 0 && (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Ainda não há dados suficientes para comparar períodos.
                  </p>
                )}
                {model.analyses.map((a) => (
                  <div
                    key={a.title}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      a.positive
                        ? "border-emerald-500/25 bg-emerald-500/5"
                        : "border-red-500/25 bg-red-500/5",
                    )}
                  >
                    <p className="text-sm font-black text-white">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{a.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionTitle
                title="Meu Desempenho Financeiro"
                subtitle="Padrões detectados nos seus atendimentos"
                icon={Sparkles}
              />
              <div className="mt-4 space-y-2.5">
                {model.insights.length === 0 && (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Sem insights disponíveis para o período.
                  </p>
                )}
                {model.insights.map((i) => (
                  <div
                    key={i.title}
                    className="rounded-xl border border-zinc-800/70 bg-[#05070d]/60 p-3 transition-colors hover:border-[#D4AF37]/30"
                  >
                    <p className="text-sm font-black text-white">{i.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{i.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <BadgesPanel model={model} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
