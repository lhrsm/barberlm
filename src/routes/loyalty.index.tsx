import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Gift,
  History,
  LayoutDashboard,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/loyalty/")({
  component: LoyaltyDashboardPage,
});

type RewardType = "free_service" | "cashback" | "credit" | "product" | "discount" | "custom";

interface SubscriptionReward {
  id: string;
  tenant_id: string;
  months_required: number;
  reward_type: RewardType;
  reward_value: number;
  reward_metadata: Record<string, unknown>;
  description: string;
  active: boolean;
  created_at: string;
}

const TYPE_LABEL: Record<RewardType, string> = {
  free_service: "Serviço grátis",
  cashback: "Cashback especial",
  credit: "Crédito",
  product: "Produto grátis",
  discount: "Desconto",
  custom: "Personalizada",
};

const TYPE_COLOR: Record<RewardType, string> = {
  free_service: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cashback: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  credit: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  product: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  discount: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  custom: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

function emptySubscriptionReward(tenantId: string): Partial<SubscriptionReward> {
  return {
    tenant_id: tenantId,
    months_required: 3,
    reward_type: "free_service",
    reward_value: 0,
    description: "",
    active: true,
  };
}

function LoyaltyDashboardPage() {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [closeCustomers, setCloseCustomers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [subscriptionRewards, setSubscriptionRewards] = useState<SubscriptionReward[]>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [syncingPremium, setSyncingPremium] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Partial<SubscriptionReward> | null>(null);

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user]);

  async function load() {
    if (!user) return;
    setLoadingData(true);
    try {
      const [profRes, settingsRes, custRes, rewardsRes, subscriptionRewardsRes, subscriptionHistoryRes] = await Promise.all([
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
        supabase
          .from("subscription_loyalty_rewards" as any)
          .select("*")
          .eq("tenant_id", user.id)
          .order("months_required", { ascending: true }),
        supabase
          .from("subscription_loyalty_history" as any)
          .select("*, reward:subscription_loyalty_rewards(description, months_required, reward_type), customer:customers(name, phone)")
          .eq("tenant_id", user.id)
          .order("granted_at", { ascending: false })
          .limit(50),
      ]);
      setProfile(profRes.data || null);
      setSettings(settingsRes.data || null);
      setCloseCustomers(custRes.data || []);
      setRewards((rewardsRes.data as any[]) || []);
      setSubscriptionRewards((subscriptionRewardsRes.data as any[]) || []);
      setSubscriptionHistory((subscriptionHistoryRes.data as any[]) || []);
    } finally {
      setLoadingData(false);
    }
  }

  async function syncSubscriptionRewards() {
    if (!user) return;
    setSyncingPremium(true);
    const { data, error } = await supabase.rpc("process_subscription_loyalty_rewards" as any);
    setSyncingPremium(false);
    if (error) return toast.error("Erro: " + error.message);
    const granted = (data as any)?.granted ?? 0;
    const notified = (data as any)?.notified ?? 0;
    toast.success(granted > 0 ? `${granted} liberada(s) · ${notified} WhatsApp enfileirado(s)` : "Nenhuma recompensa nova");
    load();
  }

  async function redeemSubscriptionReward(id: string) {
    if (!confirm("Marcar esta recompensa como resgatada?")) return;
    const { error } = await supabase.rpc("redeem_subscription_reward" as any, {
      p_history_id: id,
      p_notes: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Recompensa resgatada");
    load();
  }

  function openNewSubscriptionReward() {
    if (!user) return;
    setEditingReward(emptySubscriptionReward(user.id));
    setRewardDialogOpen(true);
  }

  function openEditSubscriptionReward(reward: SubscriptionReward) {
    setEditingReward({ ...reward });
    setRewardDialogOpen(true);
  }

  async function saveSubscriptionReward() {
    if (!editingReward || !user) return;
    if (!editingReward.description?.trim()) return toast.error("Informe a descrição da recompensa");
    if (!editingReward.months_required || editingReward.months_required < 1) return toast.error("Meses requeridos deve ser maior que 0");
    const payload: any = { ...editingReward, tenant_id: user.id };
    const { error } = editingReward.id
      ? await supabase.from("subscription_loyalty_rewards" as any).update(payload).eq("id", editingReward.id)
      : await supabase.from("subscription_loyalty_rewards" as any).insert(payload);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Recompensa salva");
    setRewardDialogOpen(false);
    setEditingReward(null);
    load();
  }

  async function removeSubscriptionReward(id: string) {
    if (!confirm("Excluir esta recompensa?")) return;
    const { error } = await supabase.from("subscription_loyalty_rewards" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recompensa excluída");
    load();
  }

  async function toggleSubscriptionReward(reward: SubscriptionReward) {
    const { error } = await supabase
      .from("subscription_loyalty_rewards" as any)
      .update({ active: !reward.active })
      .eq("id", reward.id);
    if (error) return toast.error(error.message);
    load();
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

  if (!user) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <div className="h-12 w-12 rounded-full border-2 border-[#ea580c]/30 border-t-[#ea580c] animate-spin mb-5" />
          <h2 className="text-xl font-black uppercase italic tracking-wider text-white">
            Carregando Fidelidade
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-sm">
            Estamos preparando seu painel.
          </p>
        </div>
      </AppLayout>
    );
  }

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

        <Card className="bg-[#0b0f17] border border-[#D4AF37]/30 text-white shadow-[0_12px_40px_rgba(212,175,55,0.06)]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-lg font-black uppercase italic tracking-wider flex items-center gap-2">
                <Crown className="h-5 w-5 text-[#D4AF37]" /> Fidelidade Premium dos Assinantes
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Recompensas por tempo de assinatura, separadas da fidelidade tradicional por atendimentos.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button
                onClick={syncSubscriptionRewards}
                disabled={syncingPremium}
                variant="outline"
                className="border-amber-500/40 bg-amber-500/5 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncingPremium ? "animate-spin" : ""}`} />
                {syncingPremium ? "Sincronizando…" : "Sincronizar"}
              </Button>
              <Button
                onClick={openNewSubscriptionReward}
                className="bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold"
              >
                <Plus className="w-4 h-4 mr-2" /> Nova recompensa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const todayIso = today.toISOString();
              const grantedToday = subscriptionHistory.filter((h: any) => h.granted_at && h.granted_at >= todayIso).length;
              const pending = subscriptionHistory.filter((h: any) => !h.notification_sent).length;
              const notified = subscriptionHistory.filter((h: any) => h.notification_sent).length;
              const failures = subscriptionHistory.filter((h: any) => h.notification_error).length;
              return (
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-3">
                  <PremiumKpi icon={<Sparkles className="w-4 h-4 text-amber-400" />} label="Liberadas hoje" value={grantedToday} tone="amber" />
                  <PremiumKpi icon={<Clock className="w-4 h-4 text-sky-400" />} label="Pendentes envio" value={pending} tone="sky" />
                  <PremiumKpi icon={<Send className="w-4 h-4 text-emerald-400" />} label="WhatsApp enviados" value={notified} tone="emerald" />
                  <PremiumKpi icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="Falhas envio" value={failures} tone="red" />
                </div>
              );
            })()}

            {subscriptionRewards.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
                <Sparkles className="w-10 h-10 text-amber-500/60 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-2">Nenhuma recompensa premium configurada</h3>
                <p className="text-sm text-zinc-400 mb-5 max-w-md mx-auto">
                  Crie recompensas escalonadas. Ex.: 3 meses → hidratação grátis · 6 meses → barba grátis · 12 meses → kit premium.
                </p>
                <Button onClick={openNewSubscriptionReward} size="sm" className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-bold">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar primeira recompensa
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptionRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className={`relative rounded-2xl border bg-gradient-to-br from-zinc-950 to-zinc-900/50 p-5 transition-all ${
                      reward.active ? "border-amber-500/30 shadow-[0_4px_24px_rgba(245,158,11,0.08)]" : "border-zinc-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-xl font-bold text-white leading-none">
                          {reward.months_required}
                          <span className="text-xs font-normal text-zinc-400 ml-1">
                            {reward.months_required === 1 ? "mês" : "meses"}
                          </span>
                        </div>
                      </div>
                      <Switch checked={reward.active} onCheckedChange={() => toggleSubscriptionReward(reward)} />
                    </div>

                    <Badge className={`mb-3 ${TYPE_COLOR[reward.reward_type]}`} variant="outline">
                      <Gift className="w-3 h-3 mr-1" /> {TYPE_LABEL[reward.reward_type]}
                    </Badge>
                    <p className="text-sm text-zinc-200 mb-2 leading-snug">{reward.description}</p>
                    {Number(reward.reward_value) > 0 && (
                      <p className="text-xs text-amber-400 font-medium mb-3">
                        {reward.reward_type === "cashback" || reward.reward_type === "discount"
                          ? `${reward.reward_value}%`
                          : `R$ ${Number(reward.reward_value).toFixed(2)}`}
                      </p>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-zinc-800">
                      <Button variant="outline" size="sm" className="flex-1 border-zinc-800 hover:border-amber-500/40" onClick={() => openEditSubscriptionReward(reward)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="border-zinc-800 hover:border-red-500/40 hover:text-red-400" onClick={() => removeSubscriptionReward(reward.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/40 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <History className="w-5 h-5 shrink-0 text-amber-400" />
                <h3 className="text-lg font-bold text-white break-words">Recompensas Premium Concedidas</h3>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 md:ml-auto" variant="outline">
                  {subscriptionHistory.filter((h) => h.status === "granted").length} pendentes
                </Badge>
              </div>
              {subscriptionHistory.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-7">
                  Nenhuma recompensa concedida ainda. Clique em <strong className="text-amber-400">Sincronizar</strong> para processar assinantes.
                </p>
              ) : (
                <div className="space-y-2">
                  {subscriptionHistory.map((historyItem) => (
                    <div key={historyItem.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">{historyItem.customer?.name || "Cliente"}</span>
                          <Badge
                            variant="outline"
                            className={historyItem.status === "redeemed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"}
                          >
                            {historyItem.status === "redeemed" ? "Resgatado" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 truncate">{historyItem.reward?.months_required}m · {historyItem.reward?.description}</p>
                        <p className="text-[10px] text-zinc-500">Concedido em {new Date(historyItem.granted_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      {historyItem.status === "granted" && (
                        <Button size="sm" onClick={() => redeemSubscriptionReward(historyItem.id)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Resgatar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              {editingReward?.id ? "Editar recompensa" : "Nova recompensa Premium"}
            </DialogTitle>
          </DialogHeader>
          {editingReward && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-zinc-300">Meses requeridos</Label>
                <Input
                  type="number"
                  min={1}
                  value={editingReward.months_required ?? 1}
                  onChange={(e) => setEditingReward({ ...editingReward, months_required: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Tipo de recompensa</Label>
                <Select value={editingReward.reward_type || "free_service"} onValueChange={(value) => setEditingReward({ ...editingReward, reward_type: value as RewardType })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300">Valor {editingReward.reward_type === "cashback" || editingReward.reward_type === "discount" ? "(%)" : "(R$)"}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editingReward.reward_value ?? 0}
                  onChange={(e) => setEditingReward({ ...editingReward, reward_value: parseFloat(e.target.value) || 0 })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Descrição</Label>
                <Textarea
                  placeholder="Ex.: Hidratação capilar grátis após 3 meses como assinante"
                  value={editingReward.description || ""}
                  onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-white mt-1 min-h-[80px]"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label className="text-zinc-300">Recompensa ativa</Label>
                <Switch checked={!!editingReward.active} onCheckedChange={(value) => setEditingReward({ ...editingReward, active: value })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)} className="border-zinc-800">Cancelar</Button>
            <Button onClick={saveSubscriptionReward} className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function PremiumKpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "amber" | "sky" | "emerald" | "red" }) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    red: "border-red-500/30 bg-red-500/5 text-red-300",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}
