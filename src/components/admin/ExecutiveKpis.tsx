import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Calendar,
  Users,
  UserPlus,
  Activity,
  Moon,
  AlertTriangle,
  DollarSign,
  Target,
  Percent,
} from "lucide-react";

interface Kpis {
  mrr: number;
  arr: number;
  arpu: number;
  ltv_estimate: number;
  paying_tenants: number;
  total_tenants: number;
  new_signups_7d: number;
  new_signups_30d: number;
  active_tenants_30d: number;
  dormant_tenants: number;
  churn_signal_30d: number;
  churn_rate_30d: number;
}

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ExecutiveKpis() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-executive-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_executive_kpis");
      if (error) throw error;
      return data as unknown as Kpis;
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "MRR", value: fmtBRL(data.mrr), icon: TrendingUp, color: "text-emerald-400", border: "border-emerald-500/30", hint: `${data.paying_tenants} pagantes` },
    { label: "ARR", value: fmtBRL(data.arr), icon: Calendar, color: "text-blue-400", border: "border-blue-500/30", hint: "projeção anual" },
    { label: "ARPU", value: fmtBRL(data.arpu), icon: DollarSign, color: "text-amber-400", border: "border-amber-500/30", hint: "receita média/cliente" },
    { label: "LTV estimado", value: fmtBRL(data.ltv_estimate), icon: Target, color: "text-indigo-400", border: "border-indigo-500/30", hint: "24 meses (est.)" },
    { label: "Churn 30d", value: `${data.churn_rate_30d.toFixed(1)}%`, icon: Percent, color: "text-rose-400", border: "border-rose-500/30", hint: `${data.churn_signal_30d} sinal(is)` },
    { label: "Barbearias", value: String(data.total_tenants), icon: Users, color: "text-purple-400", border: "border-purple-500/30", hint: `${data.paying_tenants} em plano pago` },
    { label: "Novos 7d", value: String(data.new_signups_7d), icon: UserPlus, color: "text-cyan-400", border: "border-cyan-500/30", hint: "últimos 7 dias" },
    { label: "Novos 30d", value: String(data.new_signups_30d), icon: UserPlus, color: "text-teal-400", border: "border-teal-500/30", hint: "últimos 30 dias" },
    { label: "Ativas 30d", value: String(data.active_tenants_30d), icon: Activity, color: "text-emerald-400", border: "border-emerald-500/30", hint: "c/ agendamentos" },
    { label: "Dormentes", value: String(data.dormant_tenants), icon: Moon, color: "text-orange-400", border: "border-orange-500/30", hint: "sem atividade 30d" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-px w-8 bg-emerald-500" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-400">
          KPIs Executivos — Tempo Real
        </span>
        {data.churn_rate_30d > 5 && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase">
            <AlertTriangle className="w-3 h-3" /> Churn alto
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className={cn("glass rounded-2xl border-2 transition-all hover:scale-[1.02]", c.border)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">
                  {c.label}
                </span>
                <c.icon className={cn("w-4 h-4", c.color)} />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">{c.value}</div>
              <div className="text-[10px] text-white/40 mt-1 font-medium">{c.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
