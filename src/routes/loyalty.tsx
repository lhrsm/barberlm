import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Trophy, TrendingDown, Users, Settings } from "lucide-react";

export const Route = createFileRoute("/loyalty")({
  component: LoyaltyDashboardPage,
});

function LoyaltyDashboardPage() {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [closeCustomers, setCloseCustomers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user]);

  async function load() {
    if (!user) return;
    setLoadingData(true);
    try {
      const [profRes, settingsRes, custRes, rewardsRes] = await Promise.all([
        supabase.from("profiles").select("loyalty_mode").eq("id", user.id).maybeSingle(),
        supabase.from("loyalty_settings" as any).select("*").eq("tenant_id", user.id).maybeSingle(),
        supabase
          .from("customers")
          .select("id, name, phone, loyalty_points")
          .eq("user_id", user.id)
          .order("loyalty_points", { ascending: false })
          .limit(20),
        supabase
          .from("loyalty_rewards" as any)
          .select("*")
          .eq("tenant_id", user.id)
          .order("earned_at", { ascending: false })
          .limit(200),
      ]);
      setProfile(profRes.data || null);
      setSettings(settingsRes.data || null);
      setCloseCustomers(custRes.data || []);
      setRewards((rewardsRes.data as any[]) || []);
    } finally {
      setLoadingData(false);
    }
  }

  const target = (settings as any)?.appointments_required ?? 10;
  const benefitDesc = (settings as any)?.benefit_description ?? "Recompensa";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const grantedMonth = rewards.filter((r: any) => new Date(r.earned_at) >= monthStart);
  const redeemedMonth = rewards.filter(
    (r: any) => r.status === "redeemed" && r.redeemed_at && new Date(r.redeemed_at) >= monthStart
  );
  const totalSavings = rewards
    .filter((r: any) => r.status === "redeemed")
    .reduce((sum: number, r: any) => sum + Number(r.barbershop_cost || 0), 0);

  const closeToReward = closeCustomers
    .filter((c: any) => (c.loyalty_points || 0) > 0)
    .slice(0, 10);

  const moduleActive = profile?.loyalty_mode === "loyalty" && (settings as any)?.enabled;

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6 min-h-screen bg-[#05070a] -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
              <Gift className="h-7 w-7 text-[#ea580c]" />
              Fidelidade
            </h2>
            <p className="text-slate-400 text-sm font-medium">
              Acompanhe o progresso dos clientes, recompensas e economia gerada.
            </p>
          </div>
          <Button asChild size="sm" className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            <Link to="/settings">
              <Settings className="h-3.5 w-3.5" /> Configurar
            </Link>
          </Button>
        </div>

        {!moduleActive && (
          <Card className="bg-amber-500/5 border-amber-500/30 text-amber-200">
            <CardContent className="p-5">
              <p className="text-sm font-bold uppercase tracking-wider">
                Programa de fidelidade desativado.
              </p>
              <p className="text-xs mt-1 text-amber-200/70">
                Ative em <Link to="/settings" className="underline">Configurações → Fidelidade</Link> para começar a gerar recompensas.
              </p>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Próximos da recompensa"
            value={closeToReward.length}
            icon={<Users className="h-5 w-5 text-[#ea580c]" />}
          />
          <KpiCard
            label="Concedidas no mês"
            value={grantedMonth.length}
            icon={<Gift className="h-5 w-5 text-emerald-400" />}
          />
          <KpiCard
            label="Utilizadas no mês"
            value={redeemedMonth.length}
            icon={<Trophy className="h-5 w-5 text-amber-400" />}
          />
          <KpiCard
            label="Economia gerada (clientes)"
            value={`R$ ${totalSavings.toFixed(2)}`}
            icon={<TrendingDown className="h-5 w-5 text-blue-400" />}
          />
        </div>

        {/* Clientes próximos da recompensa */}
        <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic tracking-wider">
              Clientes próximos da recompensa
            </CardTitle>
            <CardDescription className="text-slate-400">
              Meta atual: <span className="text-[#ea580c] font-bold">{target} atendimentos</span> — Benefício:{" "}
              <span className="text-[#ea580c] font-bold">{benefitDesc}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : closeToReward.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhum cliente acumulando pontos ainda.</p>
            ) : (
              <div className="space-y-3">
                {closeToReward.map((c: any) => {
                  const pct = Math.min(100, Math.round(((c.loyalty_points || 0) / target) * 100));
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#05070d] border border-[#1f2937]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                          {c.loyalty_points || 0} de {target}
                        </p>
                        <div className="mt-1 h-1.5 w-full bg-[#1f2937] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#ea580c] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="outline" className="border-[#ea580c]/40 text-[#ea580c] font-bold">
                        {pct}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de recompensas */}
        <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic tracking-wider">
              Últimas recompensas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rewards.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhuma recompensa ainda.</p>
            ) : (
              <div className="space-y-2">
                {rewards.slice(0, 20).map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#05070d] border border-[#1f2937]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{r.benefit_description}</p>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Gerada em {new Date(r.earned_at).toLocaleDateString("pt-BR")}
                        {r.status === "redeemed" && r.redeemed_at && (
                          <> · Usada em {new Date(r.redeemed_at).toLocaleDateString("pt-BR")}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "available"
                          ? "border-emerald-500/40 text-emerald-400"
                          : r.status === "redeemed"
                          ? "border-amber-500/40 text-amber-400"
                          : "border-slate-500/40 text-slate-400"
                      }
                    >
                      {r.status === "available"
                        ? "Disponível"
                        : r.status === "redeemed"
                        ? "Usada"
                        : r.status === "expired"
                        ? "Expirada"
                        : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-2xl font-black italic mt-1">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-[#05070d] border border-[#1f2937] flex items-center justify-center">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
