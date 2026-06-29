import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { withModule } from "@/components/modules/withModule";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, LayoutDashboard, Users, Gift, TrendingUp, Award, Loader2, Trophy } from "lucide-react";

export const Route = createFileRoute("/loyalty/dashboard")({
  component: withModule("loyalty", "Dashboard de Fidelidade", LoyaltyDashboard),
});

function LoyaltyDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCampaigns: 0,
    participating: 0,
    rewardsGranted: 0,
    valueGranted: 0,
    cashback: 0,
    credits: 0,
    conversionRate: 0,
    topCampaign: null as any,
  });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [campsRes, partsRes, cashbackRes] = await Promise.all([
        supabase.from("loyalty_campaigns" as any).select("id,name,status").eq("tenant_id", user.id),
        supabase.from("loyalty_campaign_participations" as any).select("id,campaign_id,unlocked_at,redeemed_at,reward_granted,current_value").eq("tenant_id", user.id),
        supabase.from("cashback_transactions" as any).select("amount,type").eq("tenant_id", user.id),
      ]);
      const camps = (campsRes.data as any[]) || [];
      const parts = (partsRes.data as any[]) || [];
      const active = camps.filter((c) => c.status === "active").length;
      const unlocked = parts.filter((p) => p.unlocked_at).length;
      const granted = parts.filter((p) => p.redeemed_at).length;
      const valueGranted = parts.reduce(
        (s, p) => s + Number(p.reward_granted?.amount || p.reward_granted?.value || 0),
        0,
      );
      const cb = (cashbackRes.data as any[]) || [];
      const cashback = cb.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount || 0), 0);

      const byCamp = new Map<string, number>();
      parts.forEach((p) => byCamp.set(p.campaign_id, (byCamp.get(p.campaign_id) || 0) + 1));
      let topId: string | null = null;
      let topCount = 0;
      byCamp.forEach((n, id) => {
        if (n > topCount) {
          topId = id;
          topCount = n;
        }
      });
      const topCampaign = topId ? { ...camps.find((c) => c.id === topId), participants: topCount } : null;

      setStats({
        activeCampaigns: active,
        participating: parts.length,
        rewardsGranted: granted,
        valueGranted,
        cashback,
        credits: 0,
        conversionRate: parts.length > 0 ? (unlocked / parts.length) * 100 : 0,
        topCampaign,
      });
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#05070d] grid place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
        </div>
      </AppLayout>
    );
  }

  const cards = [
    { label: "Campanhas ativas", value: stats.activeCampaigns, icon: Award, color: "#f59e0b" },
    { label: "Clientes participando", value: stats.participating, icon: Users, color: "#3b82f6" },
    { label: "Recompensas concedidas", value: stats.rewardsGranted, icon: Gift, color: "#10b981" },
    { label: "Valor concedido (R$)", value: `R$ ${stats.valueGranted.toFixed(2)}`, icon: TrendingUp, color: "#a855f7" },
    { label: "Cashback total (R$)", value: `R$ ${stats.cashback.toFixed(2)}`, icon: TrendingUp, color: "#06b6d4" },
    { label: "Taxa de conversão", value: `${stats.conversionRate.toFixed(1)}%`, icon: Trophy, color: "#ec4899" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          <div className="flex items-center gap-3">
            <Link to="/loyalty" className="h-10 w-10 rounded-xl border border-zinc-800 grid place-items-center text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center">
              <LayoutDashboard className="h-7 w-7 text-[#f59e0b]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black">Dashboard Premium</h1>
              <p className="text-sm text-zinc-400">Métricas em tempo real das suas campanhas de fidelidade.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-[#0b0f17] border border-zinc-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400">{c.label}</p>
                  <c.icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
                <p className="text-2xl md:text-3xl font-black" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {stats.topCampaign && (
            <div className="bg-gradient-to-br from-[#f59e0b]/10 to-[#ea580c]/5 border border-[#f59e0b]/30 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider font-bold text-[#f59e0b] mb-2">Campanha mais utilizada</p>
              <h3 className="text-2xl font-black text-white">{stats.topCampaign.name}</h3>
              <p className="text-sm text-zinc-300 mt-1">{stats.topCampaign.participants} clientes participando</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
