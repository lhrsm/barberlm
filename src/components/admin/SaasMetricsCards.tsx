import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Calendar,
  CreditCard,
  TrendingDown,
  Percent,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanRow {
  id: string;
  slug: string | null;
  name: string;
  price_monthly: number;
  tier: number | null;
}

interface BarbershopRow {
  id: string;
  plan_id: string | null;
  created_at: string;
}

interface Metrics {
  mrr: number;
  arr: number;
  activeSubs: number;
  totalShops: number;
  conversionRate: number; // % com plano não-Starter
  churn: number; // placeholder (sem tabela de cancelamentos própria)
  byPlan: { name: string; slug: string; count: number; revenue: number; color: string }[];
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-zinc-500",
  professional: "bg-amber-500",
  elite: "bg-purple-500",
  enterprise: "bg-emerald-500",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SaasMetricsCards() {
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ["saas-metrics"],
    queryFn: async () => {
      const [{ data: plans }, { data: shops }] = await Promise.all([
        supabase.from("plans").select("id, slug, name, price_monthly, tier"),
        supabase.from("barbershops" as any).select("id, plan_id, created_at"),
      ]);

      const plansList = (plans || []) as PlanRow[];
      const shopsList = (shops || []) as BarbershopRow[];
      const planById = new Map(plansList.map((p) => [p.id, p]));

      let mrr = 0;
      const byPlanMap = new Map<string, { name: string; slug: string; count: number; revenue: number }>();
      let withPlan = 0;
      let nonStarter = 0;

      for (const shop of shopsList) {
        if (!shop.plan_id) continue;
        const plan = planById.get(shop.plan_id);
        if (!plan) continue;
        withPlan += 1;
        const price = Number(plan.price_monthly) || 0;
        mrr += price;
        if (plan.slug && plan.slug !== "starter") nonStarter += 1;
        const slug = plan.slug || plan.name.toLowerCase();
        const entry = byPlanMap.get(slug) || { name: plan.name, slug, count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += price;
        byPlanMap.set(slug, entry);
      }

      const byPlan = Array.from(byPlanMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((p) => ({ ...p, color: PLAN_COLORS[p.slug] || "bg-blue-500" }));

      return {
        mrr,
        arr: mrr * 12,
        activeSubs: withPlan,
        totalShops: shopsList.length,
        conversionRate: shopsList.length ? (nonStarter / shopsList.length) * 100 : 0,
        churn: 0, // requires subscription history table; mostrado como 0% até integrarmos com Stripe
        byPlan,
      };
    },
    staleTime: 30_000,
  });

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "MRR", value: fmtBRL(metrics.mrr), icon: TrendingUp, color: "text-emerald-400", border: "border-emerald-500/30" },
    { label: "ARR", value: fmtBRL(metrics.arr), icon: Calendar, color: "text-blue-400", border: "border-blue-500/30" },
    { label: "Assinaturas ativas", value: String(metrics.activeSubs), icon: CreditCard, color: "text-purple-400", border: "border-purple-500/30" },
    { label: "Barbearias totais", value: String(metrics.totalShops), icon: Layers, color: "text-amber-400", border: "border-amber-500/30" },
    { label: "Conversão (pago)", value: `${metrics.conversionRate.toFixed(1)}%`, icon: Percent, color: "text-pink-400", border: "border-pink-500/30" },
    { label: "Churn 30d", value: `${metrics.churn.toFixed(1)}%`, icon: TrendingDown, color: "text-rose-400", border: "border-rose-500/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-px w-8 bg-amber-500" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">Métricas SaaS — Barbex</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className={cn("glass rounded-2xl border-2", c.border)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">{c.label}</span>
                <c.icon className={cn("w-4 h-4", c.color)} />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Receita / assinantes por plano */}
      <Card className="glass rounded-2xl border border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Receita por plano</h3>
              <p className="text-xs text-white/50 mt-1">MRR detalhado por nível de assinatura</p>
            </div>
            <span className="text-xs text-white/40">Total: <strong className="text-white">{fmtBRL(metrics.mrr)}</strong></span>
          </div>

          {metrics.byPlan.length === 0 ? (
            <p className="text-sm text-white/50">Nenhuma barbearia com plano definido ainda.</p>
          ) : (
            <div className="space-y-4">
              {metrics.byPlan.map((p) => {
                const pct = metrics.mrr ? (p.revenue / metrics.mrr) * 100 : 0;
                return (
                  <div key={p.slug}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-white uppercase tracking-wider">{p.name}</span>
                      <span className="text-white/60">
                        {p.count} {p.count === 1 ? "barbearia" : "barbearias"} · <strong className="text-white">{fmtBRL(p.revenue)}</strong>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={cn("h-full transition-all", p.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
