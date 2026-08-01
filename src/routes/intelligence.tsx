import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Radar,
  Users,
  CalendarClock,
  ShoppingBag,
  CircleDollarSign,
  Megaphone,
  Gift,
  Lightbulb,
  Cake,
  Crown,
  AlertTriangle,
  Ticket,
  Coins,
  CreditCard,
  Star,
  Scissors,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useIntelligenceData } from "@/components/intelligence/useIntelligenceData";
import { buildIntelligence, brl } from "@/components/intelligence/engine";
import { SectionCard, CustomerList, EmptyState, SkeletonBlock, RadarCard } from "@/components/intelligence/ui";

export const Route = createFileRoute("/intelligence")({
  component: IntelligencePage,
  head: () => ({
    meta: [
      { title: "Central de Inteligência Comercial | Barbex" },
      {
        name: "description",
        content:
          "Painel estratégico do Barbex: oportunidades de faturamento, clientes inativos, horários ociosos e recomendações baseadas nos seus dados.",
      },
      { property: "og:title", content: "Central de Inteligência Comercial | Barbex" },
      {
        property: "og:description",
        content: "Transforme os dados da sua barbearia em oportunidades reais de crescimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function IntelligencePage() {
  const { tenantId } = useTenant();
  const { data, isLoading, isFetching, refetch } = useIntelligenceData(tenantId ?? null);
  const iq = useMemo(() => buildIntelligence(data), [data]);

  const idleToday = iq.idle.today.reduce((s, i) => s + i.freeSlots, 0);
  const inactive = iq.inactiveBuckets.reduce((s, b) => s + b.rows.length, 0);
  const totalPotential = iq.radar.reduce((s, r) => s + r.potential, 0);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#12161f] via-[#0b0f17] to-[#0b0f17] p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Barbex Intelligence</p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Central de Inteligência Comercial</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/55">
                Tudo abaixo é calculado a partir dos dados que sua barbearia já possui. Nenhuma automação é alterada —
                as ações apenas abrem os módulos existentes.
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 rounded-xl bg-gold/15 text-xs font-black text-gold hover:bg-gold/25"
            >
              <RefreshCcw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} aria-hidden />
              Atualizar
            </Button>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <HeroStat label="Horários vagos hoje" value={String(idleToday)} />
            <HeroStat label="Clientes inativos" value={String(inactive)} />
            <HeroStat label="Aniversariantes hoje" value={String(iq.birthdays.today.length)} />
            <HeroStat label="Perto de recompensa" value={String(iq.nearReward.length)} />
            <HeroStat
              label="Faturamento na semana"
              value={brl(iq.finance.revenueThisWeek)}
              hint={
                iq.finance.weekTrendPct === null
                  ? undefined
                  : `${iq.finance.weekTrendPct >= 0 ? "+" : ""}${iq.finance.weekTrendPct}% vs semana passada`
              }
              tone={iq.finance.weekTrendPct === null ? "neutral" : iq.finance.weekTrendPct >= 0 ? "up" : "down"}
            />
            <HeroStat label="Potencial mapeado" value={brl(totalPotential)} hint={`${iq.radar.length} oportunidades`} />
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock rows={5} />
            <SkeletonBlock rows={5} />
          </div>
        ) : (
          <Tabs defaultValue="radar" className="space-y-5">
            <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-2xl border border-gold/15 bg-[#0b0f17] p-1">
              {[
                ["radar", "Radar", Radar],
                ["clientes", "Clientes", Users],
                ["agenda", "Agenda", CalendarClock],
                ["produtos", "Produtos & Serviços", ShoppingBag],
                ["financeiro", "Financeiro", CircleDollarSign],
                ["marketing", "Marketing", Megaphone],
                ["fidelizacao", "Fidelização", Gift],
                ["insights", "Insights", Lightbulb],
              ].map(([value, label, Icon]: any) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-xl px-3 py-2 text-xs font-bold data-[state=active]:bg-gold/15 data-[state=active]:text-gold"
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* RADAR */}
            <TabsContent value="radar" className="space-y-5">
              <SectionCard title="Radar Comercial" subtitle="Oportunidades priorizadas de 0 a 100" icon={Radar}>
                {iq.radar.length === 0 ? (
                  <EmptyState text="Nenhuma oportunidade identificada no momento." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {iq.radar.map((item) => (
                      <RadarCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Oportunidades de Crescimento" subtitle="Ações recomendadas" icon={TrendingUp}>
                {iq.radar.length === 0 ? (
                  <EmptyState text="Sem recomendações no momento." />
                ) : (
                  <ul className="space-y-2">
                    {iq.radar.slice(0, 8).map((r) => (
                      <li
                        key={`rec-${r.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-gold/25"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{r.title}</p>
                          <p className="truncate text-[11px] text-white/45">
                            {r.detail} • Impacto estimado {brl(r.potential)} • Execução {r.effort}
                          </p>
                        </div>
                        <Button asChild size="sm" className="h-8 rounded-lg bg-gold text-xs font-black text-black hover:bg-gold/85">
                          <Link to={r.action.to!}>Executar ação</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </TabsContent>

            {/* CLIENTES */}
            <TabsContent value="clientes" className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Clientes inativos"
                subtitle="Por tempo sem retornar"
                icon={Users}
                action={{ label: "Criar campanha", to: "/campaigns" }}
              >
                <div className="space-y-4">
                  {iq.inactiveBuckets.map((b) => (
                    <div key={b.label}>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gold/70">
                        {b.label} — {b.rows.length} clientes
                      </p>
                      <CustomerList rows={b.rows.map((row) => ({ row }))} limit={3} emptyText="Ninguém nesta faixa." />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Aniversariantes"
                subtitle="Hoje, semana e mês"
                icon={Cake}
                action={{ label: "Ver automações", to: "/automations" }}
              >
                <div className="space-y-4">
                  {[
                    ["Hoje", iq.birthdays.today],
                    ["Esta semana", iq.birthdays.week],
                    ["Este mês", iq.birthdays.month],
                  ].map(([label, rows]: any) => (
                    <div key={label}>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gold/70">
                        {label} — {rows.length}
                      </p>
                      <CustomerList rows={rows.map((row: any) => ({ row }))} limit={3} emptyText="Nenhum aniversariante." />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Clientes VIP" subtitle="Maior valor e frequência" icon={Crown}>
                <CustomerList
                  rows={iq.vips.map((row) => ({
                    row,
                    reason: `${row.visits} visitas • ${brl(row.totalSpent)} no total • última há ${row.daysSince ?? "—"} dias`,
                  }))}
                  limit={8}
                  emptyText="Ainda sem histórico suficiente."
                />
              </SectionCard>

              <SectionCard
                title="Clientes em risco"
                subtitle="Queda de frequência, ticket ou cancelamento"
                icon={AlertTriangle}
                action={{ label: "Criar campanha", to: "/campaigns" }}
              >
                <CustomerList rows={iq.atRisk} limit={8} emptyText="Nenhum sinal de risco identificado." />
              </SectionCard>
            </TabsContent>

            {/* AGENDA */}
            <TabsContent value="agenda" className="grid gap-4 lg:grid-cols-3">
              {[
                ["Hoje", iq.idle.today],
                ["Amanhã", iq.idle.tomorrow],
                ["Próximos 7 dias", iq.idle.week],
              ].map(([label, rows]: any) => (
                <SectionCard
                  key={label}
                  title={`Horários ociosos — ${label}`}
                  subtitle="Capacidade livre por profissional"
                  icon={CalendarClock}
                  action={{ label: "Abrir agenda", to: "/calendar" }}
                >
                  {rows.length === 0 ? (
                    <EmptyState text="Agenda cheia ou sem profissionais ativos." />
                  ) : (
                    <ul className="space-y-2">
                      {rows.slice(0, 8).map((s: any, i: number) => (
                        <li
                          key={`${s.barberId}-${s.date}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{s.barberName}</p>
                            <p className="text-[11px] text-white/45">{s.label}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gold">{s.freeSlots} vagas</p>
                            <p className="text-[10px] text-white/40">{brl(s.potential)} potencial</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              ))}
            </TabsContent>

            {/* PRODUTOS & SERVIÇOS */}
            <TabsContent value="produtos" className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Produtos" subtitle="Giro e estoque" icon={ShoppingBag} action={{ label: "Criar promoção", to: "/products" }}>
                <div className="space-y-4">
                  <MiniList
                    label="Mais vendidos"
                    items={iq.products.topSellers.map((p) => ({ text: p.name, hint: `${p.count} un • ${brl(p.total)}` }))}
                  />
                  <MiniList label="Sem vendas no período" items={iq.products.noSales.map((p) => ({ text: p.name, hint: brl(p.price) }))} />
                  <MiniList
                    label="Estoque baixo"
                    items={iq.products.lowStock.map((p) => ({ text: p.name, hint: `${p.stock_quantity ?? 0} em estoque` }))}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Serviços" subtitle="Tendência dos últimos 30 dias" icon={Scissors}>
                <div className="space-y-4">
                  <MiniList
                    label="Em alta"
                    icon={TrendingUp}
                    items={iq.services.rising.map((s) => ({ text: s.name, hint: `+${s.pct}%` }))}
                  />
                  <MiniList
                    label="Em queda"
                    icon={TrendingDown}
                    items={iq.services.falling.map((s) => ({ text: s.name, hint: `${s.pct}%` }))}
                  />
                  <MiniList label="Pouco vendidos" items={iq.services.lowVolume.map((s) => ({ text: s.name, hint: `${s.count} atendimentos` }))} />
                  <MiniList
                    label="Mais rentáveis"
                    items={iq.services.topRevenue.map((s) => ({ text: s.name, hint: `${brl(s.total)} • ${s.count}x` }))}
                  />
                </div>
              </SectionCard>
            </TabsContent>

            {/* FINANCEIRO */}
            <TabsContent value="financeiro" className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Panorama financeiro" subtitle="Dados dos módulos existentes" icon={CircleDollarSign} action={{ label: "Abrir financeiro", to: "/finances" }}>
                <div className="grid grid-cols-2 gap-3">
                  <HeroStat label="Receita no mês" value={brl(iq.finance.revenueThisMonth)} />
                  <HeroStat label="Ticket médio" value={brl(iq.finance.ticketThisMonth)} hint={iq.finance.ticketTrendPct === null ? undefined : `${iq.finance.ticketTrendPct}% vs mês anterior`} />
                  <HeroStat label="Cancelamentos (30d)" value={`${iq.finance.cancelRate30}%`} />
                  <HeroStat label="Ocupação (7d)" value={`${iq.finance.occupancy7}%`} />
                </div>
              </SectionCard>

              <SectionCard title="Créditos" subtitle="Saldos e vencimentos" icon={Coins} action={{ label: "Incentivar uso", to: "/finances" }}>
                <CustomerList
                  rows={iq.credits.withBalance.map((row) => ({ row, reason: `${brl(row.credits)} em créditos disponíveis` }))}
                  limit={6}
                  emptyText="Nenhum cliente com saldo em créditos."
                />
                {iq.credits.expiringSoon.length > 0 && (
                  <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2 text-xs text-amber-300">
                    {iq.credits.expiringSoon.length} créditos vencem nos próximos 30 dias.
                  </p>
                )}
              </SectionCard>
            </TabsContent>

            {/* MARKETING */}
            <TabsContent value="marketing" className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Cupons" subtitle="Módulo existente de cupons" icon={Ticket} action={{ label: "Criar campanha", to: "/campaigns" }}>
                <div className="space-y-4">
                  <MiniList label="Ativos" items={iq.coupons.active.map((c) => ({ text: c.code, hint: `${c.used_count || 0} usos` }))} />
                  <MiniList
                    label="Expirando em 15 dias"
                    items={iq.coupons.expiring.map((c) => ({ text: c.code, hint: new Date(c.expires_at).toLocaleDateString("pt-BR") }))}
                  />
                  <MiniList label="Mais utilizados" items={iq.coupons.mostUsed.map((c) => ({ text: c.code, hint: `${c.used_count} usos` }))} />
                  <MiniList label="Nunca utilizados" items={iq.coupons.neverUsed.map((c) => ({ text: c.code, hint: "0 usos" }))} />
                </div>
              </SectionCard>

              <SectionCard title="Avaliações" subtitle="Reputação e follow-up" icon={Star} action={{ label: "Abrir avaliações", to: "/reviews" }}>
                <div className="space-y-3 text-sm text-white/70">
                  <Row label="Avaliações negativas (nota ≤ 3)" value={String(iq.reviews.negative.length)} />
                  <Row label="Depoimentos sem resposta" value={String(iq.reviews.pendingReply.length)} />
                  <Row label="Atendimentos sem avaliação (30d)" value={String(iq.reviews.notReviewed)} />
                </div>
              </SectionCard>
            </TabsContent>

            {/* FIDELIZAÇÃO */}
            <TabsContent value="fidelizacao" className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Cashback" subtitle="Saldo disponível dos clientes" icon={Gift} action={{ label: "Abrir fidelidade", to: "/loyalty" }}>
                <CustomerList
                  rows={iq.cashback.withBalance.map((row) => ({ row, reason: `${brl(row.cashback)} de cashback disponível` }))}
                  limit={6}
                  emptyText="Nenhum cliente com cashback acumulado."
                />
                {iq.cashback.neverUsed.length > 0 && (
                  <p className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.07] px-4 py-2 text-xs text-gold">
                    {iq.cashback.neverUsed.length} clientes com cashback parado há mais de 30 dias.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="Próximos de recompensa" subtitle="Programa de fidelidade" icon={Gift} action={{ label: "Incentivar retorno", to: "/loyalty" }}>
                <CustomerList rows={iq.nearReward} limit={8} emptyText="Nenhum cliente próximo de recompensa." />
              </SectionCard>

              <SectionCard title="Assinaturas" subtitle="Renovação e uso de benefícios" icon={CreditCard} action={{ label: "Abrir assinaturas", to: "/subscriptions" }}>
                <div className="space-y-3 text-sm text-white/70">
                  <Row label="Renovando em até 10 dias" value={String(iq.subscriptions.renewing.length)} />
                  <Row label="Baixa utilização no período" value={String(iq.subscriptions.lowUsage.length)} />
                  <Row label="Sem utilizar benefícios" value={String(iq.subscriptions.unused.length)} />
                </div>
              </SectionCard>
            </TabsContent>

            {/* INSIGHTS */}
            <TabsContent value="insights">
              <SectionCard title="Insights automáticos" subtitle="Calculado sobre os seus dados — sem IA" icon={Lightbulb}>
                {iq.insights.length === 0 ? (
                  <EmptyState text="Ainda não há dados suficientes para gerar insights." />
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {iq.insights.map((i) => (
                      <li
                        key={i.id}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-sm font-medium transition-transform duration-200 hover:translate-x-0.5",
                          i.tone === "gold" && "border-gold/30 bg-gold/[0.07] text-gold",
                          i.tone === "positive" && "border-green-500/25 bg-green-500/[0.07] text-green-300",
                          i.tone === "warning" && "border-amber-500/25 bg-amber-500/[0.07] text-amber-300",
                          i.tone === "neutral" && "border-white/10 bg-white/[0.03] text-white/75",
                        )}
                      >
                        {i.text}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

function HeroStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-gold/15 bg-black/30 p-3 transition-all duration-200 hover:border-gold/35">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/45">{label}</p>
      <p className="mt-1 truncate text-xl font-black text-white">{value}</p>
      {hint && (
        <p
          className={cn(
            "truncate text-[10px] font-bold",
            tone === "up" && "text-green-400",
            tone === "down" && "text-amber-400",
            tone === "neutral" && "text-white/40",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-sm font-black text-gold">{value}</span>
    </div>
  );
}

function MiniList({
  label,
  items,
  icon: Icon,
}: {
  label: string;
  items: { text: string; hint?: string }[];
  icon?: any;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold/70">
        {Icon && <Icon className="h-3 w-3" aria-hidden />}
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-white/35">Sem registros.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((it, i) => (
            <li
              key={`${it.text}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs transition-colors hover:border-gold/25"
            >
              <span className="truncate text-white/80">{it.text}</span>
              {it.hint && <span className="shrink-0 font-bold text-white/50">{it.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
