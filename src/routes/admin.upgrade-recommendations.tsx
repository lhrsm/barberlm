import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminUpgradeRecommendations } from "@/lib/addons-engine.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, CheckCircle2, XCircle, Clock, Percent, DollarSign, Sparkles } from "lucide-react";
import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/admin/upgrade-recommendations")({
  component: AdminUpgradeRecommendations,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
  head: () => ({
    meta: [
      { title: "Recomendações de Upgrade · Barbex Admin" },
      { name: "description", content: "Observabilidade das recomendações inteligentes de upgrade de plano exibidas aos clientes." },
    ],
  }),
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(v) ? v : 0);

function AdminUpgradeRecommendations() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-upgrade-recommendations", days],
    queryFn: async () => {
      const r = await listAdminUpgradeRecommendations({ data: { days } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    staleTime: 30_000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-300" />
            Recomendações de Upgrade
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Observabilidade das sugestões de plano superior exibidas no carrinho de add-ons.
          </p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40 bg-white/[0.03] border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 180 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/60 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : error ? (
        <div className="text-red-300 text-sm">{(error as Error).message}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Sparkles className="w-4 h-4" />} label="Exibidas" value={String(data.kpis.total_shown)} accent="amber" />
            <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Aceitas" value={String(data.kpis.total_accepted)} accent="emerald" />
            <KpiCard icon={<XCircle className="w-4 h-4" />} label="Dispensadas" value={String(data.kpis.total_dismissed)} accent="rose" />
            <KpiCard icon={<Clock className="w-4 h-4" />} label="Pendentes" value={String(data.kpis.total_pending)} accent="slate" />
            <KpiCard icon={<Percent className="w-4 h-4" />} label="Conversão" value={`${(data.kpis.conversion_rate * 100).toFixed(1)}%`} accent="amber" />
            <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Economia ofertada / mês" value={brl(data.kpis.total_monthly_savings_offered)} accent="slate" />
            <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Economia aceita / mês" value={brl(data.kpis.total_monthly_savings_accepted)} accent="emerald" />
          </div>

          <Card className="bg-white/[0.03] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-white/50 text-[11px] uppercase tracking-wider border-b border-white/10">
                    <th className="text-left py-2 px-2">Tenant</th>
                    <th className="text-left py-2 px-2">De → Para</th>
                    <th className="text-left py-2 px-2">Ciclo</th>
                    <th className="text-right py-2 px-2">Atual</th>
                    <th className="text-right py-2 px-2">Upgrade</th>
                    <th className="text-right py-2 px-2">Econ./mês</th>
                    <th className="text-left py-2 px-2">Motivo</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Exibida</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-white/40">
                        Nenhuma recomendação registrada no período.
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 px-2">
                          <div className="text-white">{r.tenant_name ?? "—"}</div>
                          <div className="text-white/40 text-[11px]">{r.tenant_email ?? r.tenant_id.slice(0, 8)}</div>
                        </td>
                        <td className="py-2 px-2 text-white/80">
                          {r.current_plan_name ?? "—"} → <span className="text-amber-300">{r.recommended_plan_name ?? "—"}</span>
                        </td>
                        <td className="py-2 px-2 text-white/70">{r.billing_cycle === "annual" ? "Anual" : "Mensal"}</td>
                        <td className="py-2 px-2 text-right text-white/80">{brl(r.current_option_total)}</td>
                        <td className="py-2 px-2 text-right text-emerald-300">{brl(r.upgrade_option_total)}</td>
                        <td className="py-2 px-2 text-right text-emerald-300 font-semibold">{brl(r.monthly_savings)}</td>
                        <td className="py-2 px-2 text-white/60 text-xs">{reasonLabel(r.recommendation_reason)}</td>
                        <td className="py-2 px-2">{statusBadge(r.customer_action)}</td>
                        <td className="py-2 px-2 text-white/50 text-xs">{new Date(r.shown_at).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "amber" | "emerald" | "rose" | "slate" }) {
  const colors: Record<string, string> = {
    amber: "border-amber-500/30 bg-amber-500/[0.06] text-amber-200",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200",
    rose: "border-rose-500/30 bg-rose-500/[0.06] text-rose-200",
    slate: "border-white/10 bg-white/[0.03] text-white/80",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[accent]}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function reasonLabel(r: string | null) {
  if (r === "cheaper") return "Mais barato";
  if (r === "includes_modules") return "Inclui módulos";
  return r ?? "—";
}

function statusBadge(a: string | null) {
  if (a === "accepted")
    return <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">Aceita</Badge>;
  if (a === "dismissed")
    return <Badge className="bg-rose-500/20 text-rose-200 border border-rose-500/30">Dispensada</Badge>;
  return <Badge className="bg-white/[0.05] text-white/60 border border-white/10">Pendente</Badge>;
}
