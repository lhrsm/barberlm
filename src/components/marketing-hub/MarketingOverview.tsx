import { Stat } from "@/routes/marketing";
import { SectionCard, SkeletonBlock, EmptyState } from "@/components/intelligence/ui";
import { brl } from "@/components/intelligence/engine";
import { Lightbulb, Megaphone, Users, MessageSquare, Target, ShoppingBag, AlertCircle, Clock, CheckCircle2, History, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MarketingAIAdvisor } from "./MarketingAIAdvisor";
import { useTenant } from "@/hooks/use-tenant";

export function MarketingOverview({ model, loading, iq }: any) {
  const { tenantId } = useTenant();
  const pct = (v: number) => `${v.toFixed(1)}%`;

  const dashboardCards = [
    { label: "Campanhas ativas", value: model.summary.activeCampaigns, icon: Megaphone, accent: "text-gold" },
    { label: "Clientes impactados", value: model.summary.impactedCustomers, icon: Users, accent: "text-blue-400" },
    { label: "Mensagens enviadas", value: model.summary.messagesSent, icon: MessageSquare, accent: "text-white" },
    { label: "Taxa de abertura", value: pct(model.summary.openRate), icon: Target, accent: "text-emerald-400" },
    { label: "Taxa de resposta", value: pct(model.summary.responseRate), icon: MessageSquare, accent: "text-blue-400" },
    { label: "Receita atribuída", value: brl(model.summary.revenueGenerated), icon: ShoppingBag, accent: "text-emerald-400" },
  ];

  const operationalStats = [
    { label: "Clientes inativos", value: iq.inactiveBuckets.reduce((s: number, b: any) => s + b.rows.length, 0), icon: AlertCircle, color: "text-rose-400", to: "/customers" },
    { label: "Aniversariantes", value: iq.birthdays.month.length, icon: Users, color: "text-gold", to: "/customers" },
    { label: "Horários vagos hoje", value: iq.idle.today.reduce((s: number, i: any) => s + i.freeSlots, 0), icon: Clock, color: "text-amber-400", to: "/calendar" },
    { label: "Cashback sem uso", value: iq.cashback.withBalance.length, icon: ShoppingBag, color: "text-gold", to: "/customers" },
    { label: "Avaliações pendentes", value: iq.reviews.notReviewed, icon: Star, color: "text-blue-400", to: "/reviews" },
    { label: "Produtos parados", value: iq.products.noSales.length, icon: ShoppingBag, color: "text-rose-400", to: "/products" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Stats Dashboard */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {dashboardCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/[0.07] bg-[#0b0f17] p-4 transition-all duration-200 hover:border-gold/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{card.label}</p>
              <card.icon size={12} className="text-white/30" />
            </div>
            <p className={cn("text-xl font-black", card.accent)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Operational Highlights */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {operationalStats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="group">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all duration-200 group-hover:bg-white/[0.04] group-hover:border-gold/20">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={12} className={stat.color} />
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{stat.label}</p>
              </div>
              <p className="text-xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-[9px] font-bold text-gold opacity-0 group-hover:opacity-100 transition-opacity">Ver público →</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Marketing AI Advisor */}
        <MarketingAIAdvisor tenantId={tenantId || ""} />

        <SectionCard title="Atividade Recente" subtitle="Últimas comunicações disparadas" icon={History}>
          {loading ? (
            <SkeletonBlock rows={3} />
          ) : model.campaigns.length === 0 ? (
            <EmptyState text="Nenhuma atividade recente encontrada." />
          ) : (
            <ul className="space-y-2">
              {model.campaigns.slice(0, 5).map((c: any) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <p className="text-[10px] text-white/40">
                      {new Date(c.date).toLocaleDateString("pt-BR")} • {c.customers} impactados • {c.result}
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                    c.status === "ativa" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-white/40"
                  )}>
                    {c.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
