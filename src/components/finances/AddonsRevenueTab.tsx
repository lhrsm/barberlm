import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { getStripeEnvironment } from "@/lib/stripe";
import { Package, TrendingUp, Sparkles, XCircle } from "lucide-react";

interface Row {
  id: string;
  status: string;
  unit_price: number;
  quantity: number;
  currency: string;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  saas_addons: { name: string; category: string | null } | null;
}

export function AddonsRevenueTab() {
  const { tenantId } = useTenant();
  const env = (() => {
    try { return getStripeEnvironment(); } catch { return "sandbox" as const; }
  })();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["addons-revenue", tenantId, env],
    queryFn: async (): Promise<Row[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_addons" as any)
        .select("id, status, unit_price, quantity, currency, trial_ends_at, cancel_at_period_end, current_period_end, saas_addons:addon_id(name, category)")
        .eq("tenant_id", tenantId)
        .eq("environment", env)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
    enabled: !!tenantId,
  });

  const active = rows.filter((r) => ["active", "trialing", "past_due"].includes(r.status));
  const trialing = active.filter((r) => r.status === "trialing");
  const paidMonthly = active
    .filter((r) => r.status !== "trialing")
    .reduce((s, r) => s + Number(r.unit_price) * (r.quantity || 1), 0);
  const potentialAfterTrial = trialing.reduce((s, r) => s + Number(r.unit_price) * (r.quantity || 1), 0);
  const canceledCount = rows.filter((r) => r.status === "canceled").length;

  if (isLoading) {
    return <div className="text-white/60 text-sm">Carregando add-ons...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi icon={TrendingUp} label="Custo mensal atual" value={`R$ ${paidMonthly.toFixed(2)}`} tone="emerald" />
        <Kpi icon={Sparkles} label="Trials ativos" value={String(trialing.length)} sub={`+ R$ ${potentialAfterTrial.toFixed(2)}/mês após trial`} tone="amber" />
        <Kpi icon={XCircle} label="Cancelados (histórico)" value={String(canceledCount)} tone="slate" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b0f17] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-white">Detalhamento de add-ons</span>
          <span className="text-xs text-white/50 ml-auto">{rows.length} contrato{rows.length !== 1 ? "s" : ""}</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/50">
            Nenhum add-on contratado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/5">
                  <th className="px-4 py-2 font-semibold">Add-on</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-right">Valor/mês</th>
                  <th className="px-4 py-2 font-semibold">Renovação / fim</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const total = Number(r.unit_price) * (r.quantity || 1);
                  return (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-white font-medium">{r.saas_addons?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} canceling={r.cancel_at_period_end} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        R$ {total.toFixed(2)}
                        {r.quantity > 1 && <span className="text-white/40 text-xs"> × {r.quantity}</span>}
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs">
                        {r.status === "trialing" && r.trial_ends_at
                          ? `Trial até ${new Date(r.trial_ends_at).toLocaleDateString("pt-BR")}`
                          : r.status === "canceled"
                            ? "—"
                            : r.current_period_end
                              ? `${r.cancel_at_period_end ? "Termina" : "Renova"} ${new Date(r.current_period_end).toLocaleDateString("pt-BR")}`
                              : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: "emerald" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/5 text-amber-300",
    slate: "border-white/10 bg-white/[0.02] text-white/60",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
      {sub && <div className="text-[11px] text-white/50 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status, canceling }: { status: string; canceling: boolean }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Ativo" },
    trialing: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "Trial" },
    past_due: { cls: "bg-orange-500/15 text-orange-300 border-orange-500/30", label: "Em atraso" },
    canceled: { cls: "bg-white/5 text-white/50 border-white/10", label: "Cancelado" },
  };
  const c = map[status] ?? { cls: "bg-white/5 text-white/60 border-white/10", label: status };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>
      {canceling && status !== "canceled" && (
        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-200 border-amber-500/30">
          termina no ciclo
        </span>
      )}
    </span>
  );
}
