import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Users,
  Coins,
  CreditCard,
  Ticket,
  ShoppingBag,
  Star,
  Zap,
  BarChart3,
  CalendarDays,
  Sparkles,
  RefreshCcw,
  Lightbulb,
  Gift,
  Crown,
  Cake,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useIntelligenceData } from "@/components/intelligence/useIntelligenceData";
import { buildIntelligence, brl } from "@/components/intelligence/engine";
import { SectionCard, CustomerList, EmptyState, SkeletonBlock } from "@/components/intelligence/ui";
import { useMarketingData } from "@/components/marketing/useMarketingData";
import { buildMarketing, type UnifiedCampaign } from "@/components/marketing/engine";

export const Route = createFileRoute("/marketing")({
  component: MarketingPage,
  head: () => ({
    meta: [
      { title: "Central de Marketing | Barbex" },
      {
        name: "description",
        content:
          "Central de Marketing do Barbex: campanhas, cashback, créditos, cupons, produtos, assinaturas, avaliações e automações em um só lugar.",
      },
      { property: "og:title", content: "Central de Marketing | Barbex" },
      {
        property: "og:description",
        content: "Todas as ferramentas de crescimento da sua barbearia centralizadas em um único ambiente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const pct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
      {hint && <p className="text-[11px] text-white/45">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<UnifiedCampaign["status"], string> = {
  ativa: "border-green-500/30 bg-green-500/10 text-green-300",
  agendada: "border-gold/30 bg-gold/10 text-gold",
  encerrada: "border-white/10 bg-white/5 text-white/60",
  rascunho: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function MarketingPage() {
  const { tenantId } = useTenant();
  const intel = useIntelligenceData(tenantId ?? null);
  const mkt = useMarketingData(tenantId ?? null);
  const iq = useMemo(() => buildIntelligence(intel.data), [intel.data]);
  const model = useMemo(() => buildMarketing(mkt.data, iq), [mkt.data, iq]);
  const loading = intel.isLoading || mkt.isLoading;
  const [search, setSearch] = useState("");

  const filteredCampaigns = useMemo(
    () =>
      model.campaigns.filter((c) =>
        search.trim() ? `${c.name} ${c.objective} ${c.origin}`.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [model.campaigns, search],
  );

  const refetchAll = () => {
    intel.refetch();
    mkt.refetch();
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#12161f] via-[#0b0f17] to-[#0b0f17] p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Barbex Growth</p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Central de Marketing</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/55">
                Todas as ferramentas comerciais da sua barbearia reunidas. Nada é alterado aqui — os botões apenas
                abrem os módulos que já funcionam no sistema.
              </p>
            </div>
            <Button
              onClick={refetchAll}
              disabled={intel.isFetching || mkt.isFetching}
              className="h-9 rounded-xl bg-gold/15 text-xs font-black text-gold hover:bg-gold/25"
            >
              <RefreshCcw className={cn("mr-2 h-4 w-4", (intel.isFetching || mkt.isFetching) && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Campanhas ativas" value={model.summary.activeCampaigns} />
            <Stat label="Campanhas encerradas" value={model.summary.endedCampaigns} />
            <Stat label="Clientes impactados" value={model.summary.impactedCustomers} />
            <Stat label="Mensagens enviadas" value={model.summary.messagesSent} />
            <Stat label="Taxa de abertura" value={pct(model.summary.openRate)} />
            <Stat label="Taxa de resposta" value={pct(model.summary.responseRate)} />
            <Stat label="Clientes fidelizados" value={model.summary.loyalCustomers} hint="3+ atendimentos" />
            <Stat label="Receita no mês" value={brl(model.summary.revenueGenerated)} />
          </div>
        </header>

        {/* Oportunidades */}
        <SectionCard title="Centro de Oportunidades" subtitle="Ações sugeridas hoje" icon={Lightbulb}>
          {loading ? (
            <SkeletonBlock rows={3} />
          ) : model.opportunities.length === 0 ? (
            <EmptyState text="Nenhuma oportunidade em destaque no momento." />
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {model.opportunities.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:border-gold/25"
                >
                  <span className="text-sm text-white/80">{o.text}</span>
                  <Button asChild size="sm" className="h-8 rounded-lg bg-gold text-xs font-black text-black hover:bg-gold/85">
                    <Link to={o.to}>{o.label}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <Tabs defaultValue="campanhas" className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-1">
            {[
              ["campanhas", "Campanhas", Megaphone],
              ["biblioteca", "Biblioteca", Sparkles],
              ["calendario", "Calendário", CalendarDays],
              ["clientes", "Clientes", Users],
              ["cashback", "Cashback", Coins],
              ["creditos", "Créditos", CreditCard],
              ["cupons", "Cupons", Ticket],
              ["produtos", "Produtos", ShoppingBag],
              ["assinaturas", "Assinaturas", Crown],
              ["avaliacoes", "Avaliações", Star],
              ["automacoes", "Automações", Zap],
              ["resultados", "Resultados", BarChart3],
            ].map(([value, label, Icon]: any) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-xl px-3 py-1.5 text-xs font-bold data-[state=active]:bg-gold/15 data-[state=active]:text-gold"
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* CAMPANHAS */}
          <TabsContent value="campanhas" className="mt-4">
            <SectionCard
              title="Central de campanhas"
              subtitle={`${filteredCampaigns.length} campanhas`}
              icon={Megaphone}
              action={{ label: "Nova campanha", to: "/campaigns" }}
            >
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar campanha..."
                aria-label="Buscar campanha"
                className="mb-4 h-9 rounded-xl border-white/10 bg-white/[0.03] text-sm"
              />
              {loading ? (
                <SkeletonBlock rows={4} />
              ) : filteredCampaigns.length === 0 ? (
                <EmptyState text="Nenhuma campanha encontrada." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-white/40">
                        <th scope="col" className="pb-2">Nome</th>
                        <th scope="col" className="pb-2">Objetivo</th>
                        <th scope="col" className="pb-2">Status</th>
                        <th scope="col" className="pb-2">Data</th>
                        <th scope="col" className="pb-2">Clientes</th>
                        <th scope="col" className="pb-2">Resultado</th>
                        <th scope="col" className="pb-2">Origem</th>
                        <th scope="col" className="pb-2">Canal</th>
                        <th scope="col" className="pb-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCampaigns.slice(0, 40).map((c) => (
                        <tr key={c.id} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                          <td className="py-3 pr-3 font-bold text-white">{c.name}</td>
                          <td className="max-w-[220px] truncate py-3 pr-3 text-white/55">{c.objective}</td>
                          <td className="py-3 pr-3">
                            <span className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase", STATUS_STYLE[c.status])}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-white/55">{fmtDate(c.date)}</td>
                          <td className="py-3 pr-3 text-white/70">{c.customers}</td>
                          <td className="py-3 pr-3 text-white/55">{c.result}</td>
                          <td className="py-3 pr-3 text-white/55">{c.origin}</td>
                          <td className="py-3 pr-3 capitalize text-white/55">{c.channel}</td>
                          <td className="py-3 text-right">
                            <Button asChild size="sm" variant="ghost" className="h-7 rounded-lg text-xs font-bold text-gold hover:bg-gold/15">
                              <Link to={c.editTo || "/campaigns"}>Gerenciar</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* BIBLIOTECA */}
          <TabsContent value="biblioteca" className="mt-4">
            <SectionCard title="Biblioteca de campanhas" subtitle="Modelos prontos" icon={Sparkles}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {model.library.map((l) => (
                  <article
                    key={l.id}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30"
                  >
                    <h3 className="text-sm font-black text-white">{l.title}</h3>
                    <p className="mt-1 text-xs text-white/55">{l.description}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-black/25 px-3 py-2">
                        <dt className="font-black uppercase tracking-widest text-white/40">Objetivo</dt>
                        <dd className="font-bold text-white">{l.objective}</dd>
                      </div>
                      <div className="rounded-lg bg-black/25 px-3 py-2">
                        <dt className="font-black uppercase tracking-widest text-white/40">Segmento</dt>
                        <dd className="font-bold text-white">{l.segment}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs italic text-white/60">
                      “{l.message}”
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white/45">{l.audience} clientes estimados</span>
                      <Button asChild size="sm" className="h-8 rounded-lg bg-gold text-xs font-black text-black hover:bg-gold/85">
                        <Link to={l.to} search={{ modelo: l.id } as any}>Usar campanha</Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          {/* CALENDÁRIO */}
          <TabsContent value="calendario" className="mt-4 space-y-4">
            <SectionCard title="Calendário comercial" subtitle="Campanhas programadas" icon={CalendarDays}>
              {loading ? (
                <SkeletonBlock rows={3} />
              ) : (
                <ul className="space-y-2">
                  {model.campaigns
                    .filter((c) => c.date && +new Date(c.date) >= Date.now() - 30 * 86400000)
                    .slice(0, 12)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{c.name}</p>
                          <p className="text-[11px] text-white/45">
                            {fmtDate(c.date)} • {c.origin} • {c.channel}
                          </p>
                        </div>
                        <span className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase", STATUS_STYLE[c.status])}>
                          {c.status}
                        </span>
                      </li>
                    ))}
                  {model.campaigns.filter((c) => c.date && +new Date(c.date) >= Date.now() - 30 * 86400000).length === 0 && (
                    <EmptyState text="Nenhuma campanha programada no período." />
                  )}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Marketing sazonal" subtitle="Próximas datas" icon={Gift}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {model.seasonal.slice(0, 6).map((s) => (
                  <article key={s.id} className="rounded-2xl border border-gold/15 bg-gold/[0.04] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gold">
                      Em {s.daysAway} dias • {fmtDate(s.date)}
                    </p>
                    <h3 className="mt-1 text-sm font-black text-white">{s.title}</h3>
                    <p className="mt-1 text-xs text-white/60">{s.idea}</p>
                    <Button asChild size="sm" className="mt-3 h-8 w-full rounded-lg bg-gold/15 text-xs font-black text-gold hover:bg-gold/25">
                      <Link to="/campaigns">Planejar campanha</Link>
                    </Button>
                  </article>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="mt-4 grid gap-4 xl:grid-cols-2">
            <SectionCard title="Clientes VIP" subtitle="Maior valor" icon={Crown} action={{ label: "Ver clientes", to: "/customers" }}>
              {loading ? <SkeletonBlock /> : <CustomerList rows={iq.vips.map((row) => ({ row }))} />}
            </SectionCard>
            <SectionCard title="Clientes inativos" subtitle="Reativação" icon={AlertTriangle}>
              {loading ? (
                <SkeletonBlock />
              ) : (
                <CustomerList rows={iq.inactiveBuckets.flatMap((b) => b.rows.map((row) => ({ row, reason: `Sem retorno há ${row.daysSince} dias` })))} />
              )}
            </SectionCard>
            <SectionCard title="Aniversariantes do mês" icon={Cake}>
              {loading ? <SkeletonBlock /> : <CustomerList rows={iq.birthdays.month.map((row) => ({ row }))} />}
            </SectionCard>
            <SectionCard title="Clientes em risco" icon={AlertTriangle}>
              {loading ? <SkeletonBlock /> : <CustomerList rows={iq.atRisk} />}
            </SectionCard>
            <SectionCard title="Clientes com cashback" icon={Coins}>
              {loading ? (
                <SkeletonBlock />
              ) : (
                <CustomerList rows={iq.cashback.withBalance.map((row) => ({ row, reason: `${brl(row.cashback)} de saldo` }))} />
              )}
            </SectionCard>
            <SectionCard title="Clientes com créditos" icon={CreditCard}>
              {loading ? (
                <SkeletonBlock />
              ) : (
                <CustomerList rows={iq.credits.withBalance.map((row) => ({ row, reason: `${brl(row.credits)} em créditos` }))} />
              )}
            </SectionCard>
          </TabsContent>

          {/* CASHBACK */}
          <TabsContent value="cashback" className="mt-4">
            <SectionCard title="Cashback" subtitle="Saldo e uso" icon={Coins} action={{ label: "Criar campanha", to: "/campaigns" }}>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Saldo disponível" value={brl(model.cashback.totalBalance)} />
                <Stat label="Clientes com saldo" value={model.cashback.withBalance} />
                <Stat label="Cashback utilizado" value={brl(model.cashback.used)} />
                <Stat label="Créditos expirando" value={model.cashback.expiring} />
              </div>
              {loading ? (
                <SkeletonBlock />
              ) : (
                <CustomerList rows={iq.cashback.withBalance.map((row) => ({ row, reason: `${brl(row.cashback)} disponível` }))} limit={8} />
              )}
            </SectionCard>
          </TabsContent>

          {/* CRÉDITOS */}
          <TabsContent value="creditos" className="mt-4">
            <SectionCard title="Créditos" icon={CreditCard} action={{ label: "Criar campanha", to: "/campaigns" }}>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat label="Saldo total" value={brl(iq.credits.withBalance.reduce((s, c) => s + c.credits, 0))} />
                <Stat label="Clientes com créditos" value={iq.credits.withBalance.length} />
                <Stat label="Expirando em breve" value={iq.credits.expiringSoon.length} />
              </div>
              {loading ? (
                <SkeletonBlock />
              ) : (
                <CustomerList rows={iq.credits.withBalance.map((row) => ({ row, reason: `${brl(row.credits)} em créditos` }))} limit={8} />
              )}
            </SectionCard>
          </TabsContent>

          {/* CUPONS */}
          <TabsContent value="cupons" className="mt-4 grid gap-4 xl:grid-cols-2">
            <SectionCard title="Cupons ativos" icon={Ticket} action={{ label: "Gerenciar", to: "/finances" }}>
              {iq.coupons.active.length === 0 ? (
                <EmptyState text="Nenhum cupom ativo." />
              ) : (
                <ul className="space-y-2">
                  {iq.coupons.active.slice(0, 8).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="font-bold text-white">{c.code}</span>
                      <span className="text-[11px] text-white/50">{c.used_count || 0} usos • expira {fmtDate(c.expires_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Mais utilizados" icon={Ticket}>
              {iq.coupons.mostUsed.length === 0 ? (
                <EmptyState text="Nenhum cupom utilizado ainda." />
              ) : (
                <ul className="space-y-2">
                  {iq.coupons.mostUsed.slice(0, 8).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="font-bold text-white">{c.code}</span>
                      <span className="text-[11px] text-white/50">{c.used_count || 0} usos</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Nunca utilizados" icon={Ticket}>
              {iq.coupons.neverUsed.length === 0 ? (
                <EmptyState text="Todos os cupons já tiveram uso." />
              ) : (
                <ul className="space-y-2">
                  {iq.coupons.neverUsed.slice(0, 8).map((c: any) => (
                    <li key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm font-bold text-white">
                      {c.code}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Expirando" icon={AlertTriangle}>
              {iq.coupons.expiring.length === 0 ? (
                <EmptyState text="Nenhum cupom próximo do vencimento." />
              ) : (
                <ul className="space-y-2">
                  {iq.coupons.expiring.slice(0, 8).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="font-bold text-white">{c.code}</span>
                      <span className="text-[11px] text-white/50">{fmtDate(c.expires_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          {/* PRODUTOS */}
          <TabsContent value="produtos" className="mt-4 grid gap-4 xl:grid-cols-3">
            <SectionCard title="Mais vendidos" icon={ShoppingBag} action={{ label: "Criar campanha", to: "/campaigns" }}>
              {iq.products.topSellers.length === 0 ? (
                <EmptyState text="Sem vendas registradas." />
              ) : (
                <ul className="space-y-2">
                  {iq.products.topSellers.slice(0, 8).map((p) => (
                    <li key={p.name} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="truncate text-sm font-bold text-white">{p.name}</span>
                      <span className="text-[11px] text-white/50">{p.count}x • {brl(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Sem venda" icon={AlertTriangle}>
              {iq.products.noSales.length === 0 ? (
                <EmptyState text="Todos os produtos venderam." />
              ) : (
                <ul className="space-y-2">
                  {iq.products.noSales.slice(0, 8).map((p: any) => (
                    <li key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm font-bold text-white">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Estoque baixo" icon={AlertTriangle} action={{ label: "Produtos", to: "/products" }}>
              {iq.products.lowStock.length === 0 ? (
                <EmptyState text="Estoque saudável." />
              ) : (
                <ul className="space-y-2">
                  {iq.products.lowStock.slice(0, 8).map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <span className="truncate text-sm font-bold text-white">{p.name}</span>
                      <span className="text-[11px] text-white/50">{p.stock_quantity} un.</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          {/* ASSINATURAS */}
          <TabsContent value="assinaturas" className="mt-4 grid gap-4 xl:grid-cols-3">
            <SectionCard title="Renovando em breve" icon={Crown} action={{ label: "Criar campanha", to: "/campaigns" }}>
              <p className="text-3xl font-black text-white">{iq.subscriptions.renewing.length}</p>
              <p className="text-xs text-white/50">assinantes com renovação próxima</p>
            </SectionCard>
            <SectionCard title="Baixa utilização" icon={AlertTriangle} action={{ label: "Assinaturas", to: "/subscriptions" }}>
              <p className="text-3xl font-black text-white">{iq.subscriptions.lowUsage.length}</p>
              <p className="text-xs text-white/50">assinantes usando pouco o plano</p>
            </SectionCard>
            <SectionCard title="Sem uso no período" icon={AlertTriangle}>
              <p className="text-3xl font-black text-white">{iq.subscriptions.unused.length}</p>
              <p className="text-xs text-white/50">assinantes sem nenhum uso</p>
            </SectionCard>
          </TabsContent>

          {/* AVALIAÇÕES */}
          <TabsContent value="avaliacoes" className="mt-4 grid gap-4 xl:grid-cols-2">
            <SectionCard title="Avaliações negativas" icon={Star} action={{ label: "Responder", to: "/reviews" }}>
              {iq.reviews.negative.length === 0 ? (
                <EmptyState text="Nenhuma avaliação negativa." />
              ) : (
                <ul className="space-y-2">
                  {iq.reviews.negative.slice(0, 6).map((r: any) => (
                    <li key={r.id} className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
                      <p className="text-sm text-white/80">{r.testimonial_text || "Sem comentário"}</p>
                      <p className="text-[11px] text-white/45">{fmtDate(r.submitted_at || r.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Aguardando resposta" icon={Star} action={{ label: "Abrir avaliações", to: "/reviews" }}>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Pendentes de resposta" value={iq.reviews.pendingReply.length} />
                <Stat label="Atendimentos sem avaliação" value={iq.reviews.notReviewed} />
              </div>
            </SectionCard>
          </TabsContent>

          {/* AUTOMAÇÕES */}
          <TabsContent value="automacoes" className="mt-4">
            <SectionCard
              title="Painel de automações"
              subtitle="Somente leitura"
              icon={Zap}
              action={{ label: "Gerenciar", to: "/automations" }}
            >
              {loading ? (
                <SkeletonBlock rows={5} />
              ) : model.automations.length === 0 ? (
                <EmptyState text="Nenhuma automação configurada." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-white/40">
                        <th scope="col" className="pb-2">Automação</th>
                        <th scope="col" className="pb-2">Grupo</th>
                        <th scope="col" className="pb-2">Status</th>
                        <th scope="col" className="pb-2">Última execução</th>
                        <th scope="col" className="pb-2">Enviadas</th>
                        <th scope="col" className="pb-2">Falhas</th>
                        <th scope="col" className="pb-2">Atualizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.automations.map((a) => (
                        <tr key={a.id} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                          <td className="py-3 pr-3 font-bold capitalize text-white">{a.label}</td>
                          <td className="py-3 pr-3 text-white/55">{a.group}</td>
                          <td className="py-3 pr-3">
                            <span
                              className={cn(
                                "rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase",
                                a.active
                                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                                  : "border-white/10 bg-white/5 text-white/50",
                              )}
                            >
                              {a.active ? "Ativa" : "Inativa"}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-white/55">{fmtDate(a.lastRun)}</td>
                          <td className="py-3 pr-3 text-white/70">{a.sent}</td>
                          <td className={cn("py-3 pr-3", a.failed > 0 ? "text-red-300" : "text-white/40")}>{a.failed}</td>
                          <td className="py-3 text-white/45">{fmtDate(a.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* RESULTADOS */}
          <TabsContent value="resultados" className="mt-4 space-y-4">
            <SectionCard title="Campanhas e alcance" subtitle="Últimos 6 meses" icon={BarChart3}>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={model.results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <ReTooltip
                      contentStyle={{ background: "#0b0f17", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12 }}
                    />
                    <Bar dataKey="messages" name="Mensagens" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                    <Line type="monotone" dataKey="impacted" name="Clientes impactados" stroke="#7dd3fc" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Campanhas por mês" icon={Megaphone}>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={model.results}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                      <ReTooltip
                        contentStyle={{ background: "#0b0f17", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12 }}
                      />
                      <Bar dataKey="campaigns" name="Campanhas" fill="#34d399" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Indicadores de retorno" icon={BarChart3}>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Receita no mês" value={brl(iq.finance.revenueThisMonth)} />
                  <Stat label="Ticket médio" value={brl(iq.finance.ticketThisMonth)} />
                  <Stat label="Ocupação 7 dias" value={pct(iq.finance.occupancy7)} />
                  <Stat label="Clientes fidelizados" value={model.summary.loyalCustomers} />
                </div>
              </SectionCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
