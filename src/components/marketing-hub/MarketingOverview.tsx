import { Stat } from "../../routes/marketing";
import { SectionCard, SkeletonBlock, EmptyState } from "../intelligence/ui";
import { brl } from "../intelligence/engine";
import { Lightbulb, Megaphone, Users, MessageSquare, Target, ShoppingBag, AlertCircle, Clock, CheckCircle2, History, Zap, Star } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";
import { MarketingAIAdvisor } from "./MarketingAIAdvisor";
import { PredictiveTrends } from "./PredictiveTrends";
import { useTenant } from "../../hooks/use-tenant";

export function MarketingOverview({ model, loading, iq }: any) {
  const { tenantId } = useTenant();
  const pct = (v: number) => (v ? v.toFixed(1) : "0.0") + "%";

  const dashboardCards = [
    { label: "Campanhas ativas", value: model?.summary?.activeCampaigns || 0, icon: Megaphone, accent: "text-gold" },
    { label: "Clientes impactados", value: model?.summary?.impactedCustomers || 0, icon: Users, accent: "text-blue-400" },
    { label: "Mensagens enviadas", value: model?.summary?.messagesSent || 0, icon: MessageSquare, accent: "text-white" },
    { label: "Taxa de abertura", value: pct(model?.summary?.openRate || 0), icon: Target, accent: "text-emerald-400" },
    { label: "Taxa de resposta", value: pct(model?.summary?.responseRate || 0), icon: MessageSquare, accent: "text-blue-400" },
    { label: "Receita atribuida", value: brl(model?.summary?.revenueGenerated || 0), icon: ShoppingBag, accent: "text-emerald-400" },
  ];

  const operationalStats = [
    { label: "Clientes inativos", value: iq?.inactiveBuckets?.reduce((s, b) => s + (b.rows?.length || 0), 0) || 0, icon: AlertCircle, color: "text-rose-400", to: "/customers" as const },
    { label: "Aniversariantes", value: iq?.birthdays?.month?.length || 0, icon: Users, color: "text-gold", to: "/customers" as const },
    { label: "Horarios vagos hoje", value: iq?.idle?.today?.reduce((s, i) => s + (i.freeSlots || 0), 0) || 0, icon: Clock, color: "text-amber-400", to: "/calendar" as const },
    { label: "Cashback sem uso", value: iq?.cashback?.withBalance?.length || 0, icon: ShoppingBag, color: "text-gold", to: "/customers" as const },
    { label: "Avaliacoes pendentes", value: iq?.reviews?.notReviewed || 0, icon: Star, color: "text-blue-400", to: "/reviews" as const },
    { label: "Produtos parados", value: iq?.products?.noSales?.length || 0, icon: ShoppingBag, color: "text-rose-400", to: "/products" as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
    </div>
  );
}
