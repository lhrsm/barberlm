import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { getStripeEnvironment } from "@/lib/stripe";
import { cancelAddon, reactivateAddon } from "@/utils/addons.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Package, XCircle, RefreshCw, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddonRow {
  id: string;
  addon_id: string;
  status: string;
  quantity: number;
  unit_price: number;
  currency: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  cancelled_at: string | null;
  saas_addons: { name: string; addon_key: string; module_key: string; category: string } | null;
}

export function YourAddons() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const env = (() => {
    try { return getStripeEnvironment(); } catch { return "sandbox" as const; }
  })();

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ["my-addons", tenantId, env],
    queryFn: async (): Promise<AddonRow[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("tenant_addons" as any)
        .select("id, addon_id, status, quantity, unit_price, currency, cancel_at_period_end, current_period_end, cancelled_at, saas_addons:addon_id(name, addon_key, module_key, category)")
        .eq("tenant_id", tenantId)
        .eq("environment", env)
        .in("status", ["active", "trialing", "past_due", "canceled"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as AddonRow[]) || [];
    },
    enabled: !!tenantId,
  });

  const cancelMut = useMutation({
    mutationFn: async (contractId: string) => {
      setPendingId(contractId);
      const r = await cancelAddon({ data: { contractId, environment: env } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-addons"] });
      qc.invalidateQueries({ queryKey: ["tenant-addons"] });
      toast.success("Cancelamento agendado. Acesso mantido até o fim do ciclo.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cancelar"),
    onSettled: () => setPendingId(null),
  });

  const reactivateMut = useMutation({
    mutationFn: async (contractId: string) => {
      setPendingId(contractId);
      const r = await reactivateAddon({ data: { contractId, environment: env } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-addons"] });
      qc.invalidateQueries({ queryKey: ["tenant-addons"] });
      toast.success("Add-on reativado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reativar"),
    onSettled: () => setPendingId(null),
  });

  const total = useMemo(
    () => addons.filter(a => ["active", "trialing"].includes(a.status))
      .reduce((s, a) => s + Number(a.unit_price) * a.quantity, 0),
    [addons]
  );

  if (isLoading) return null;

  return (
    <div className="bg-[#0b0f17] border border-white/10 rounded-2xl p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 grid place-items-center">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Seus módulos adicionais</h3>
            <p className="text-xs text-white/50">
              {addons.length === 0 ? "Nenhum contratado ainda." : `${addons.length} contratado${addons.length > 1 ? "s" : ""} • R$ ${total.toFixed(2)}/mês`}
            </p>
          </div>
        </div>
        <Link to="/subscription/addons">
          <Button size="sm" variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs">
            Ver catálogo <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>

      {addons.length === 0 ? (
        <div className="text-center py-6 text-sm text-white/50">
          Personalize sua assinatura contratando apenas os módulos que precisa.
        </div>
      ) : (
        <div className="space-y-2">
          {addons.map((a) => {
            const isActive = ["active", "trialing"].includes(a.status);
            const isCanceling = a.cancel_at_period_end;
            const isCanceled = a.status === "canceled";
            return (
              <div key={a.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                isCanceled ? "border-white/5 bg-white/[0.02] opacity-60" :
                isCanceling ? "border-amber-500/30 bg-amber-500/5" :
                "border-white/10 bg-white/[0.02]"
              }`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{a.saas_addons?.name ?? "—"}</span>
                    {isCanceling && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                        Termina em {a.current_period_end ? new Date(a.current_period_end).toLocaleDateString("pt-BR") : "—"}
                      </Badge>
                    )}
                    {isCanceled && (
                      <Badge className="bg-white/10 text-white/50 border-white/10 text-[10px]">Cancelado</Badge>
                    )}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    R$ {Number(a.unit_price).toFixed(2)}/mês
                    {a.quantity > 1 && ` × ${a.quantity}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isActive && !isCanceling && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelMut.mutate(a.id)}
                      disabled={pendingId === a.id}
                      className="text-white/60 hover:text-red-400 hover:bg-red-500/10 text-xs"
                    >
                      {pendingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                      Cancelar
                    </Button>
                  )}
                  {isCanceling && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reactivateMut.mutate(a.id)}
                      disabled={pendingId === a.id}
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                    >
                      {pendingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
