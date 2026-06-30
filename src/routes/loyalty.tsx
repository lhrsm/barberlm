import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Trophy, TrendingDown, Users, Settings, LayoutDashboard, ListChecks, Sparkles } from "lucide-react";

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

  const moduleActive = !!(settings as any)?.enabled;

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <div className="h-12 w-12 rounded-full border-2 border-[#ea580c]/30 border-t-[#ea580c] animate-spin mb-5" />
          <h2 className="text-xl font-black uppercase italic tracking-wider text-white">
            Carregando Fidelidade
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-sm">
            Estamos verificando suas configurações e permissões.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

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
          <div className="-mx-1 px-1 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <LoyaltyNavButton to="/loyalty/templates" icon={<Sparkles className="h-4 w-4" />} label="Templates Premium" />
              <LoyaltyNavButton to="/loyalty/campaigns" icon={<ListChecks className="h-4 w-4" />} label="Minhas Campanhas" />
              <LoyaltyNavButton to="/loyalty/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
              <LoyaltyNavButton to="/settings" search={{ tab: "loyalty" }} icon={<Settings className="h-4 w-4" />} label="Configurar" />
            </div>
          </div>
        </div>



        {loadingData ? (
          <Card className="bg-[#0b0f17] border border-[#1f2937] text-white">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-[#ea580c]/30 border-t-[#ea580c] animate-spin" />
              <p className="text-sm text-slate-400">Carregando dados da fidelidade...</p>
            </CardContent>
          </Card>
        ) : !moduleActive && (
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

        {/* Aviso: separação Fidelidade Tradicional x Premium */}
        <Card className="bg-gradient-to-r from-[#D4AF37]/10 via-amber-500/5 to-transparent border-[#D4AF37]/30 text-white">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 grid place-items-center shrink-0">
              <Trophy className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-wider text-[#D4AF37]">
                Fidelidade Premium é separada
              </p>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Esta página gerencia a <strong>fidelidade tradicional</strong> (por número de atendimentos).
                Assinantes premium possuem regras próprias por tempo de assinatura dentro desta mesma central. Cálculos nunca se misturam.
              </p>
            </div>
          </CardContent>
        </Card>



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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {closeToReward.map((c: any) => {
                  const points = c.loyalty_points || 0;
                  const pct = Math.min(100, Math.round((points / target) * 100));
                  const remaining = Math.max(0, target - points);
                  return (
                    <div
                      key={c.id}
                      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1420] to-[#05070d] border border-[#1f2937] hover:border-[#ea580c]/50 transition-all p-5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(234,88,12,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                            {remaining === 0 ? "Recompensa liberada" : `Faltam ${remaining}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-[#ea580c]/40 text-[#ea580c] font-bold shrink-0">
                          {pct}%
                        </Badge>
                      </div>

                      <div className="flex items-end justify-center gap-1 py-2">
                        <span className="text-5xl font-black italic text-[#ea580c] leading-none tabular-nums">
                          {points}
                        </span>
                        <span className="text-lg font-bold text-slate-500 leading-none pb-1">
                          /{target}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-[#1f2937] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#ea580c] to-[#f97316] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">
                          Atendimentos
                        </p>
                      </div>
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

function LoyaltyNavButton({
  to,
  search,
  icon,
  label,
  active = false,
}: {
  to: string;
  search?: Record<string, string>;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  const base =
    "shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 cursor-pointer";
  const cls = active
    ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-black border border-[#f59e0b] shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:shadow-[0_8px_28px_rgba(245,158,11,0.55)]"
    : "bg-[#0b0f17] text-white border border-[#f59e0b]/30 [&_svg]:text-[#f59e0b] hover:border-[#f59e0b]/70 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]";
  return (
    <Link
      to={to as any}
      search={search as any}
      activeOptions={{ exact: true }}
      className={`${base} ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
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
