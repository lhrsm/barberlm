import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Crown,
  Plus,
  Pencil,
  Trash2,
  Gift,
  Clock,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  History,
  AlertTriangle,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/subscription-rewards")({
  component: SubscriptionRewardsPage,
});

type RewardType = "free_service" | "cashback" | "credit" | "product" | "discount" | "custom";

interface Reward {
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

function empty(tenantId: string): Partial<Reward> {
  return {
    tenant_id: tenantId,
    months_required: 3,
    reward_type: "free_service",
    reward_value: 0,
    description: "",
    active: true,
  };
}

function SubscriptionRewardsPage() {
  const { user, loading: authLoading } = useAuth();
  const tenantId = user?.id;
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: rs, error: e1 }, { data: hs, error: e2 }] = await Promise.all([
      supabase
        .from("subscription_loyalty_rewards" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("months_required", { ascending: true }),
      supabase
        .from("subscription_loyalty_history" as any)
        .select("*, reward:subscription_loyalty_rewards(description, months_required, reward_type), customer:customers(name, phone)")
        .eq("tenant_id", tenantId)
        .order("granted_at", { ascending: false })
        .limit(50),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) toast.error(e2.message);
    setRewards((rs as any) || []);
    setHistory((hs as any) || []);
    setLoading(false);
  }

  async function syncRewards() {
    if (!tenantId) return;
    setSyncing(true);
    // Roda a rotina global (todos os tenants) — backend filtra por elegibilidade
    const { data, error } = await supabase.rpc("process_subscription_loyalty_rewards" as any);
    setSyncing(false);
    if (error) return toast.error("Erro: " + error.message);
    const granted = (data as any)?.granted ?? 0;
    const notified = (data as any)?.notified ?? 0;
    toast.success(granted > 0 ? `${granted} liberada(s) · ${notified} WhatsApp enfileirado(s)` : "Nenhuma recompensa nova");
    load();
  }

  async function redeem(id: string) {
    if (!confirm("Marcar esta recompensa como resgatada?")) return;
    const { error } = await supabase.rpc("redeem_subscription_reward" as any, {
      p_history_id: id,
      p_notes: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Recompensa resgatada");
    load();
  }

  useEffect(() => {
    if (!authLoading && tenantId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, tenantId]);

  function openNew() {
    if (!tenantId) return;
    setEditing(empty(tenantId));
    setDialogOpen(true);
  }

  function openEdit(r: Reward) {
    setEditing({ ...r });
    setDialogOpen(true);
  }

  async function save() {
    if (!editing || !tenantId) return;
    if (!editing.description?.trim()) {
      toast.error("Informe a descrição da recompensa");
      return;
    }
    if (!editing.months_required || editing.months_required < 1) {
      toast.error("Meses requeridos deve ser maior que 0");
      return;
    }
    const payload: any = { ...editing, tenant_id: tenantId };
    const { error } = editing.id
      ? await supabase
          .from("subscription_loyalty_rewards" as any)
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("subscription_loyalty_rewards" as any).insert(payload);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Recompensa salva");
    setDialogOpen(false);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta recompensa?")) return;
    const { error } = await supabase
      .from("subscription_loyalty_rewards" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recompensa excluída");
    load();
  }

  async function toggleActive(r: Reward) {
    const { error } = await supabase
      .from("subscription_loyalty_rewards" as any)
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[#05070d]">
          <div className="text-zinc-400">Carregando…</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Fidelidade Premium</h1>
              </div>
              <p className="text-sm text-zinc-400 max-w-2xl">
                Recompensas exclusivas para assinantes baseadas no <strong className="text-amber-400">tempo de assinatura</strong>. Diferente da fidelidade tradicional, aqui o cliente acumula meses — não atendimentos.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={syncRewards}
                disabled={syncing}
                variant="outline"
                className="border-amber-500/40 bg-amber-500/5 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 hover:border-amber-400"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando…" : "Sincronizar recompensas"}
              </Button>
              <Button
                onClick={openNew}
                className="bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" /> Nova recompensa
              </Button>
            </div>
          </div>

          {/* KPIs da automação */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();
            const grantedToday = history.filter((h: any) => h.granted_at && h.granted_at >= todayIso).length;
            const pending = history.filter((h: any) => !h.notification_sent).length;
            const failures = history.filter((h: any) => h.notification_error).length;
            const notified = history.filter((h: any) => h.notification_sent).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-amber-400" /><span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Liberadas hoje</span></div>
                  <p className="text-2xl font-black text-white">{grantedToday}</p>
                </div>
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
                  <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-sky-400" /><span className="text-[10px] uppercase tracking-widest text-sky-300 font-bold">Pendentes envio</span></div>
                  <p className="text-2xl font-black text-white">{pending}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-1"><Send className="w-4 h-4 text-emerald-400" /><span className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">WhatsApp enviados</span></div>
                  <p className="text-2xl font-black text-white">{notified}</p>
                </div>
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-[10px] uppercase tracking-widest text-red-300 font-bold">Falhas envio</span></div>
                  <p className="text-2xl font-black text-white">{failures}</p>
                </div>
              </div>
            );
          })()}

          {/* Lista */}
          {rewards.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-12 text-center">
              <Sparkles className="w-12 h-12 text-amber-500/60 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Nenhuma recompensa configurada
              </h3>
              <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
                Crie recompensas escalonadas. Ex.: 3 meses → hidratação grátis · 6 meses → barba grátis · 12 meses → kit premium.
              </p>
              <Button
                onClick={openNew}
                className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" /> Criar primeira recompensa
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((r) => (
                <div
                  key={r.id}
                  className={`relative rounded-2xl border bg-gradient-to-br from-zinc-950 to-zinc-900/50 p-5 transition-all ${
                    r.active
                      ? "border-amber-500/30 shadow-[0_4px_24px_rgba(245,158,11,0.08)]"
                      : "border-zinc-800 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white leading-none">
                          {r.months_required}
                          <span className="text-xs font-normal text-zinc-400 ml-1">
                            {r.months_required === 1 ? "mês" : "meses"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={r.active}
                      onCheckedChange={() => toggleActive(r)}
                    />
                  </div>

                  <Badge className={`mb-3 ${TYPE_COLOR[r.reward_type]}`} variant="outline">
                    <Gift className="w-3 h-3 mr-1" /> {TYPE_LABEL[r.reward_type]}
                  </Badge>

                  <p className="text-sm text-zinc-200 mb-2 leading-snug">{r.description}</p>

                  {Number(r.reward_value) > 0 && (
                    <p className="text-xs text-amber-400 font-medium mb-3">
                      {r.reward_type === "cashback" || r.reward_type === "discount"
                        ? `${r.reward_value}%`
                        : `R$ ${Number(r.reward_value).toFixed(2)}`}
                    </p>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-zinc-800">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-zinc-800 hover:border-amber-500/40"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-800 hover:border-red-500/40 hover:text-red-400"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Histórico de recompensas concedidas */}
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Recompensas Concedidas</h2>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 ml-auto" variant="outline">
                {history.filter((h) => h.status === "granted").length} pendentes
              </Badge>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                Nenhuma recompensa concedida ainda. Clique em <strong className="text-amber-400">Sincronizar</strong> para processar assinantes.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">
                          {h.customer?.name || "Cliente"}
                        </span>
                        {h.status === "redeemed" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                            Resgatado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">
                        {h.reward?.months_required}m · {h.reward?.description}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Concedido em {new Date(h.granted_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {h.status === "granted" && (
                      <Button
                        size="sm"
                        onClick={() => redeem(h.id)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Resgatar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              {editing?.id ? "Editar recompensa" : "Nova recompensa Premium"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-zinc-300">Meses requeridos</Label>
                <Input
                  type="number"
                  min={1}
                  value={editing.months_required ?? 1}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      months_required: parseInt(e.target.value) || 1,
                    })
                  }
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Tipo de recompensa</Label>
                <Select
                  value={editing.reward_type || "free_service"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, reward_type: v as RewardType })
                  }
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-zinc-300">
                  Valor{" "}
                  {editing.reward_type === "cashback" || editing.reward_type === "discount"
                    ? "(%)"
                    : "(R$)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.reward_value ?? 0}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      reward_value: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-zinc-900 border-zinc-800 text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Descrição</Label>
                <Textarea
                  placeholder="Ex.: Hidratação capilar grátis após 3 meses como assinante"
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="bg-zinc-900 border-zinc-800 text-white mt-1 min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-zinc-300">Recompensa ativa</Label>
                <Switch
                  checked={!!editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={save}
              className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
