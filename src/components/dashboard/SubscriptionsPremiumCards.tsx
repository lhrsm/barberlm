import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Crown, DollarSign, Users, TrendingUp, Sparkles } from "lucide-react";

type Sub = {
  id: string;
  status: string;
  started_at: string | null;
  created_at: string;
  canceled_at: string | null;
  plan_id: string;
  plan: { id: string; name: string; monthly_price: number } | null;
};

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SubscriptionsPremiumCards({ tenantId }: { tenantId: string }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: subData }, { data: planData }] = await Promise.all([
        supabase
          .from("customer_subscriptions")
          .select(
            "id, status, started_at, created_at, canceled_at, plan_id, plan:subscription_plans(id, name, monthly_price)"
          )
          .eq("tenant_id", tenantId),
        supabase
          .from("subscription_plans")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name"),
      ]);
      if (!active) return;
      setSubs((subData as any[]) || []);
      setPlans((planData as any[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [tenantId]);

  const filtered = useMemo(() => {
    const fromD = new Date(from + "T00:00:00");
    const toD = new Date(to + "T23:59:59");
    return subs.filter((s) => {
      if (planFilter !== "all" && s.plan_id !== planFilter) return false;
      const ref = s.started_at ? new Date(s.started_at) : new Date(s.created_at);
      return ref <= toD && (s.status === "active" || ref >= fromD);
    });
  }, [subs, planFilter, from, to]);

  const kpis = useMemo(() => {
    const active = filtered.filter((s) => s.status === "active");
    const mrr = active.reduce(
      (acc, s) => acc + Number(s.plan?.monthly_price || 0),
      0
    );
    const arr = mrr * 12;
    const fromD = new Date(from + "T00:00:00");
    const newInRange = filtered.filter((s) => {
      const ref = s.started_at ? new Date(s.started_at) : new Date(s.created_at);
      return ref >= fromD;
    }).length;
    const arpu = active.length > 0 ? mrr / active.length : 0;
    return { activeCount: active.length, mrr, arr, newInRange, arpu };
  }, [filtered, from]);

  const fieldClass =
    "h-12 rounded-xl bg-[#05070D] border border-white/10 text-white placeholder:text-slate-500 focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/15 focus-visible:ring-2 focus-visible:ring-[#f59e0b]/15 focus-visible:ring-offset-0 [color-scheme:dark]";
  const labelClass =
    "text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5 block";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center shadow-md">
            <Crown className="h-4 w-4 text-black" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-white">
              Assinaturas Premium
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Receita recorrente e assinantes ativos
            </p>
          </div>
        </div>
        <Badge className="rounded-full px-3 py-1.5 bg-[#f59e0b]/12 text-[#f59e0b] border border-[#f59e0b]/35 font-bold uppercase text-[11px]">
          Fidelidade separada
        </Badge>
      </div>

      {/* Filtros */}
      <div
        className="rounded-2xl p-5 shadow-lg shadow-black/30"
        style={{
          background: "#0B1220",
          border: "1px solid rgba(245,158,11,0.18)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <Label className={labelClass}>De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Plano</Label>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1220] border-white/10 text-white">
                <SelectItem value="all">Todos os planos</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-500/30 shadow-lg shadow-amber-500/5 hover:border-amber-500/60 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">
                Assinantes Ativos
              </span>
              <div className="p-2 bg-amber-500/15 rounded-lg">
                <Users className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter text-amber-700">
              {loading ? "—" : kpis.activeCount}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-amber-600/60 mt-1">
              +{kpis.newInRange} no período
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 hover:border-emerald-500/60 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900">
                MRR
              </span>
              <div className="p-2 bg-emerald-500/15 rounded-lg">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter text-emerald-700">
              {loading ? "—" : fmtBRL(kpis.mrr)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-emerald-600/60 mt-1">
              Receita recorrente mensal
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-50 to-white border-2 border-sky-500/30 shadow-lg shadow-sky-500/5 hover:border-sky-500/60 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-900">
                ARR
              </span>
              <div className="p-2 bg-sky-500/15 rounded-lg">
                <TrendingUp className="h-4 w-4 text-sky-600" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter text-sky-700">
              {loading ? "—" : fmtBRL(kpis.arr)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-sky-600/60 mt-1">
              Receita anualizada
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-500/30 shadow-lg shadow-purple-500/5 hover:border-purple-500/60 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-900">
                ARPU Médio
              </span>
              <div className="p-2 bg-purple-500/15 rounded-lg">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter text-purple-700">
              {loading ? "—" : fmtBRL(kpis.arpu)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-purple-600/60 mt-1">
              Receita média por assinante
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
