import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  ShoppingBag,
  Package,
  TrendingUp,
  Boxes,
  Users,
  Ticket,
  Gift,
  Layers,
  Radar,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCommerceData } from "./useCommerceData";
import {
  computeOverview,
  productPerformance,
  categoryBreakdown,
  revenueSeries,
  monthlySeries,
  topCustomers,
  crossSellPairs,
  opportunities,
  couponInsights,
  cashbackInsights,
} from "./engine";
import { MetricCard, Panel, RankRow, EmptyState, LoadingGrid, money } from "./ui";
import { RevenueChart, MonthlyChart, CategoryChart, RadarPanel, CrossSellPanel } from "./CommerceCharts";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Visão geral", icon: BarChart3 },
  { value: "products", label: "Produtos", icon: Package },
  { value: "stock", label: "Estoque", icon: Boxes },
  { value: "orders", label: "Pedidos", icon: ShoppingBag },
  { value: "customers", label: "Clientes", icon: Users },
  { value: "radar", label: "Radar", icon: Radar },
  { value: "promos", label: "Cupons & Cashback", icon: Ticket },
];

export default function CommerceCenter() {
  const { user } = useAuth();
  const { data, isLoading } = useCommerceData(user?.id);
  const [tab, setTab] = React.useState("overview");
  const [margin, setMargin] = React.useState(40);
  const [minStock, setMinStock] = React.useState(3);

  const marginRate = margin / 100;
  const products = data?.products || [];
  const sales = data?.sales || [];

  const overview = React.useMemo(() => computeOverview(sales, products, marginRate), [sales, products, marginRate]);
  const perf = React.useMemo(() => productPerformance(sales, products, marginRate), [sales, products, marginRate]);
  const cats = React.useMemo(() => categoryBreakdown(perf), [perf]);
  const daily = React.useMemo(() => revenueSeries(sales, 30), [sales]);
  const monthly = React.useMemo(() => monthlySeries(sales, 12), [sales]);
  const clients = React.useMemo(() => topCustomers(sales, data?.customers || []), [sales, data?.customers]);
  const pairs = React.useMemo(() => crossSellPairs(sales), [sales]);
  const radar = React.useMemo(() => opportunities(perf, cats, minStock), [perf, cats, minStock]);
  const coupons = React.useMemo(() => couponInsights(data?.coupons || []), [data?.coupons]);
  const cashback = React.useMemo(() => cashbackInsights(data?.cashback || []), [data?.cashback]);

  const topSellers = React.useMemo(() => [...perf].filter((p) => p.units > 0).sort((a, b) => b.revenue - a.revenue), [perf]);
  const idle = React.useMemo(
    () => [...perf].filter((p) => p.units === 0 || (p.daysIdle ?? 999) >= 30).sort((a, b) => (b.daysIdle ?? 999) - (a.daysIdle ?? 999)),
    [perf],
  );
  const critical = React.useMemo(() => [...perf].filter((p) => p.stock <= minStock).sort((a, b) => a.stock - b.stock), [perf, minStock]);
  const maxRevenue = Math.max(...topSellers.map((p) => p.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/[0.12] via-white/[0.03] to-transparent p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D4AF37]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.32em] text-[#D4AF37]">
              <Sparkles className="h-3 w-3" /> Centro Comercial Barbex
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {money(overview.revenueMonth)} <span className="text-sm font-bold text-muted-foreground">no mês</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.unitsMonth} unidades vendidas • {overview.ordersMonth} pedidos • ticket médio {money(overview.avgTicket)}
            </p>
          </div>
          <div className="w-full max-w-[260px]">
            <label className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Margem estimada</span>
              <span className="text-[#D4AF37]">{margin}%</span>
            </label>
            <Slider
              value={[margin]}
              min={5}
              max={90}
              step={1}
              onValueChange={(v) => setMargin(v[0])}
              aria-label="Margem estimada para cálculo de lucro"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Apenas informativo — não altera dados.</p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Receita hoje" value={money(overview.revenueToday)} hint={`${overview.unitsToday} un.`} icon={DollarSign} loading={isLoading} tooltip="Soma dos pedidos de produtos de hoje (exclui cancelados/estornados)." />
          <MetricCard label="Receita no mês" value={money(overview.revenueMonth)} delta={overview.monthDelta ?? undefined} icon={TrendingUp} loading={isLoading} tooltip="Comparado ao mesmo acumulado do mês anterior." />
          <MetricCard label="Ticket médio" value={money(overview.avgTicket)} hint={`${overview.itemsPerOrder.toFixed(1)} itens/pedido`} icon={ShoppingBag} loading={isLoading} />
          <MetricCard label="Lucro estimado" value={money(overview.estimatedProfitMonth)} hint={`margem ${margin}%`} icon={Layers} loading={isLoading} tooltip="Projeção informativa: receita do mês x margem escolhida." />
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "h-9 gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-muted-foreground transition-all",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4AF37] data-[state=active]:to-[#F5D061] data-[state=active]:text-black",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          {isLoading ? (
            <LoadingGrid count={4} />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Receita total" value={money(overview.revenueTotal)} hint="12 meses" icon={DollarSign} />
              <MetricCard label="Produtos ativos" value={String(overview.activeProducts)} hint={`${overview.categories} categorias`} icon={Package} />
              <MetricCard label="Valor em estoque" value={money(overview.stockValue)} hint="preço de venda" icon={Boxes} />
              <MetricCard label="Lucro estimado (12m)" value={money(overview.estimatedProfit)} hint={`margem ${margin}%`} icon={Layers} />
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <RevenueChart data={daily} />
            <MonthlyChart data={monthly} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <CategoryChart data={cats} />
            <CrossSellPanel pairs={pairs} />
          </div>
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="products" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title="Mais vendidos" description="Ranking por receita">
            {topSellers.length ? (
              <ul className="space-y-2">
                {topSellers.slice(0, 10).map((p, i) => (
                  <RankRow
                    key={p.product.id}
                    index={i + 1}
                    title={p.product.name}
                    subtitle={`${p.units} un. • lucro estimado ${money(p.profit)}`}
                    value={money(p.revenue)}
                    progress={(p.revenue / maxRevenue) * 100}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="Nenhuma venda de produto registrada ainda." />
            )}
          </Panel>
          <Panel title="Produtos parados" description="Sem vendas nos últimos 30 dias">
            {idle.length ? (
              <ul className="space-y-2">
                {idle.slice(0, 10).map((p, i) => (
                  <RankRow
                    key={p.product.id}
                    index={i + 1}
                    title={p.product.name}
                    subtitle={p.daysIdle === null ? "Nunca vendido" : `Última venda há ${p.daysIdle} dias`}
                    value={`${p.stock} un.`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="Todos os produtos tiveram vendas recentes." />
            )}
          </Panel>
        </TabsContent>

        {/* STOCK */}
        <TabsContent value="stock" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Valor em estoque" value={money(overview.stockValue)} icon={Boxes} />
            <MetricCard label="Itens em estoque" value={String(perf.reduce((a, p) => a + p.stock, 0))} icon={Package} />
            <MetricCard label="Estoque crítico" value={String(critical.length)} hint={`≤ ${minStock} un.`} icon={Radar} />
            <MetricCard label="Sem estoque" value={String(perf.filter((p) => p.stock === 0).length)} icon={Package} />
          </div>
          <Panel
            title="Reposição sugerida"
            description="Produtos que precisam de atenção"
            action={
              <div className="w-40">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Estoque mínimo: {minStock}
                </label>
                <Slider value={[minStock]} min={1} max={20} step={1} onValueChange={(v) => setMinStock(v[0])} aria-label="Estoque mínimo" />
              </div>
            }
          >
            {critical.length ? (
              <ul className="space-y-2">
                {critical.slice(0, 12).map((p, i) => (
                  <RankRow
                    key={p.product.id}
                    index={i + 1}
                    title={p.product.name}
                    subtitle={`${p.units} vendidos • ${p.lastSale ? `última venda em ${p.lastSale.toLocaleDateString("pt-BR")}` : "sem vendas"}`}
                    value={`${p.stock} un.`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="Nenhum produto abaixo do estoque mínimo." />
            )}
          </Panel>
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders" className="mt-5">
          <Panel title="Pedidos recentes" description="Últimos pedidos de produtos">
            {sales.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 font-black">Pedido</th>
                      <th className="pb-2 font-black">Data</th>
                      <th className="pb-2 font-black">Itens</th>
                      <th className="pb-2 font-black">Status</th>
                      <th className="pb-2 text-right font-black">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 20).map((s) => {
                      const items = (() => {
                        try {
                          const arr = typeof s.items === "string" ? JSON.parse(s.items) : s.items;
                          return Array.isArray(arr) ? arr : [];
                        } catch {
                          return [];
                        }
                      })();
                      return (
                        <tr key={s.id} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
                          <td className="py-3 font-mono text-xs text-muted-foreground">#{String(s.id).slice(0, 8)}</td>
                          <td className="py-3 text-xs">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                          <td className="py-3 text-xs">{items.map((i: any) => i?.name).filter(Boolean).join(", ") || "—"}</td>
                          <td className="py-3">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-black uppercase",
                                s.status === "completed"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : s.status === "cancelled"
                                    ? "bg-rose-500/15 text-rose-400"
                                    : "bg-amber-500/15 text-amber-400",
                              )}
                            >
                              {s.status === "completed" ? "Concluído" : s.status === "cancelled" ? "Cancelado" : "Estornado"}
                            </span>
                          </td>
                          <td className="py-3 text-right font-black text-[#D4AF37]">{money(Number(s.total_amount || 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="Nenhum pedido registrado nos últimos 12 meses." />
            )}
          </Panel>
        </TabsContent>

        {/* CUSTOMERS */}
        <TabsContent value="customers" className="mt-5">
          <Panel title="Clientes que mais compram" description="Valor gasto, produto favorito e última compra">
            {clients.length ? (
              <ul className="space-y-2">
                {clients.map((c, i) => (
                  <RankRow
                    key={c.id}
                    index={i + 1}
                    title={c.name}
                    subtitle={`${c.orders} pedidos • favorito: ${c.favorite}${c.last ? ` • última em ${c.last.toLocaleDateString("pt-BR")}` : ""}`}
                    value={money(c.spent)}
                    progress={(c.spent / Math.max(clients[0].spent, 1)) * 100}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="Ainda não há compras vinculadas a clientes." />
            )}
          </Panel>
        </TabsContent>

        {/* RADAR */}
        <TabsContent value="radar" className="mt-5 space-y-5">
          <RadarPanel items={radar} />
          <CrossSellPanel pairs={pairs} />
        </TabsContent>

        {/* PROMOS */}
        <TabsContent value="promos" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Cupons ativos" value={String(coupons.active)} hint={`${coupons.total} no total`} icon={Ticket} />
            <MetricCard label="Usos de cupom" value={String(coupons.used)} hint={coupons.conversion !== null ? `${coupons.conversion.toFixed(1)}% do limite` : "sem limite"} icon={TrendingUp} />
            <MetricCard label="Cashback concedido" value={money(cashback.granted)} icon={Gift} />
            <MetricCard label="Cashback utilizado" value={money(cashback.spent)} hint={`${cashback.balanceRate.toFixed(0)}% de resgate`} icon={Gift} />
          </div>
          <Panel title="Cupons mais utilizados" description="Somente leitura — gerencie em Cupons">
            {coupons.top.length ? (
              <ul className="space-y-2">
                {coupons.top.map((c: any, i: number) => (
                  <RankRow
                    key={c.id}
                    index={i + 1}
                    title={c.code}
                    subtitle={`${c.type === "percent" ? `${c.value}%` : money(Number(c.value || 0))} • ${c.active === false ? "inativo" : "ativo"}`}
                    value={`${c.used_count || 0} usos`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="Nenhum cupom cadastrado." />
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
