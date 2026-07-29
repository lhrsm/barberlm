import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Repeat, Zap, Crown, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  finances: "Financeiro",
  loyalty: "Fidelidade",
  subscriptions: "Assinaturas",
  products: "Produtos",
  automations: "Automações",
  reviews: "Avaliações",
  commissions: "Comissões",
  campaigns: "Campanhas",
  reports: "Relatórios",
};

function dayKey(d: string | Date) {
  return format(new Date(d), "yyyy-MM-dd");
}

export function AdminEngagementTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-engagement"],
    queryFn: async () => {
      const since90 = subDays(new Date(), 90).toISOString();

      const [{ data: appointments }, { data: profiles }, { data: modules }, { data: customers }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("tenant_id, created_at, status")
            .gte("created_at", since90),
          supabase.from("profiles").select("id, tenant_id, business_name, created_at, status"),
          supabase.from("barbershop_modules").select("tenant_id, module_key, enabled"),
          supabase.from("customers").select("tenant_id, created_at").gte("created_at", since90),
        ]);

      const apps = appointments ?? [];
      const shops = profiles ?? [];
      const totalShops = shops.length || 1;

      const activeIn = (days: number) => {
        const limit = subDays(new Date(), days).getTime();
        return new Set(
          apps
            .filter((a) => new Date(a.created_at).getTime() >= limit && a.tenant_id)
            .map((a) => a.tenant_id as string)
        );
      };

      const dau = activeIn(1).size;
      const wau = activeIn(7).size;
      const mau = activeIn(30).size;
      const stickiness = mau ? Math.round((dau / mau) * 100) : 0;

      // Retenção: barbearias com mais de 30 dias que continuam ativas nos últimos 30 dias
      const cutoff = subDays(new Date(), 30).getTime();
      const older = shops.filter((p) => new Date(p.created_at).getTime() < cutoff);
      const activeSet = activeIn(30);
      const retained = older.filter((p) => activeSet.has(p.tenant_id ?? p.id)).length;
      const retention = older.length ? Math.round((retained / older.length) * 100) : 0;

      // Atividade diária (últimos 14 dias) – barbearias ativas x agendamentos
      const days = Array.from({ length: 14 }, (_, i) => dayKey(subDays(new Date(), 13 - i)));
      const activity = days.map((d) => {
        const dayApps = apps.filter((a) => dayKey(a.created_at) === d);
        return {
          day: format(new Date(d), "dd/MM", { locale: ptBR }),
          barbearias: new Set(dayApps.map((a) => a.tenant_id)).size,
          agendamentos: dayApps.length,
        };
      });

      // Novos cadastros por semana (8 semanas)
      const weeks = Array.from({ length: 8 }, (_, i) =>
        startOfWeek(subDays(new Date(), (7 - i) * 7), { weekStartsOn: 1 })
      );
      const signups = weeks.map((w) => {
        const start = w.getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        return {
          day: format(w, "dd/MM", { locale: ptBR }),
          cadastros: shops.filter((p) => {
            const t = new Date(p.created_at).getTime();
            return t >= start && t < end;
          }).length,
        };
      });

      // Adoção de módulos
      const enabled = (modules ?? []).filter((m) => m.enabled);
      const byModule = new Map<string, Set<string>>();
      enabled.forEach((m) => {
        const set = byModule.get(m.module_key) ?? new Set<string>();
        set.add(m.tenant_id as string);
        byModule.set(m.module_key, set);
      });
      const adoption = Array.from(byModule.entries())
        .map(([key, set]) => ({
          key,
          label: MODULE_LABELS[key] ?? key,
          count: set.size,
          pct: Math.round((set.size / totalShops) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Ranking de barbearias (30 dias)
      const nameOf = new Map<string, string>();
      shops.forEach((p) =>
        nameOf.set((p.tenant_id ?? p.id) as string, p.business_name || "Sem nome")
      );
      const counts = new Map<string, number>();
      apps
        .filter((a) => new Date(a.created_at).getTime() >= cutoff && a.tenant_id)
        .forEach((a) =>
          counts.set(a.tenant_id as string, (counts.get(a.tenant_id as string) ?? 0) + 1)
        );
      const ranking = Array.from(counts.entries())
        .map(([tenantId, count]) => ({
          tenantId,
          name: nameOf.get(tenantId) ?? "Barbearia",
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const newCustomers30 = (customers ?? []).filter(
        (c) => new Date(c.created_at).getTime() >= cutoff
      ).length;

      const inactive = shops.filter((p) => !activeSet.has(p.tenant_id ?? p.id)).length;

      return {
        dau,
        wau,
        mau,
        stickiness,
        retention,
        activity,
        signups,
        adoption,
        ranking,
        newCustomers30,
        inactive,
        totalShops: shops.length,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl bg-white/5" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: "Ativos hoje", value: data.dau, icon: Activity, color: "text-emerald-400", desc: "barbearias com movimento" },
    { label: "Ativos 7 dias", value: data.wau, icon: Users, color: "text-blue-400", desc: `de ${data.totalShops} contas` },
    { label: "Stickiness", value: `${data.stickiness}%`, icon: Zap, color: "text-gold", desc: "DAU / MAU" },
    { label: "Retenção 30d", value: `${data.retention}%`, icon: Repeat, color: "text-purple-400", desc: "contas maduras ativas" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="glass border-white/5 rounded-3xl overflow-hidden shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{kpi.label}</span>
              <div className={cn("p-2 rounded-xl bg-white/5", kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight mb-2 text-white">{kpi.value}</div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{kpi.desc}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-4 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold">Atividade diária</CardTitle>
            <CardDescription className="text-gray-500 font-medium">
              Barbearias ativas e agendamentos criados nos últimos 14 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity}>
                <defs>
                  <linearGradient id="engGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="engPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="agendamentos" stroke="#8B5CF6" strokeWidth={3} fill="url(#engPurple)" />
                <Area type="monotone" dataKey="barbearias" stroke="#D4AF37" strokeWidth={3} fill="url(#engGold)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold">Adoção de módulos</CardTitle>
            <CardDescription className="text-gray-500 font-medium">
              % das barbearias com cada módulo ativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {data.adoption.length === 0 && (
              <p className="text-sm text-gray-500 font-medium">Nenhum módulo ativo registrado ainda.</p>
            )}
            {data.adoption.map((m) => (
              <div key={m.key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white uppercase tracking-tight">{m.label}</span>
                  <span className="text-xs font-black text-gold">{m.pct}%</span>
                </div>
                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all duration-1000"
                    style={{ width: `${Math.min(m.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-3 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold" /> Barbearias mais engajadas
            </CardTitle>
            <CardDescription className="text-gray-500 font-medium">
              Ranking por agendamentos nos últimos 30 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {data.ranking.length === 0 && (
              <p className="text-sm text-gray-500 font-medium">Sem atividade no período.</p>
            )}
            {data.ranking.map((r, i) => (
              <div
                key={r.tenantId}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-gold/30 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-gold/15 text-gold text-xs font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.name}</p>
                </div>
                <Badge className="bg-white/10 text-white border-none rounded-lg font-bold">{r.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
          <CardHeader className="bg-white/5 px-8 py-6">
            <CardTitle className="text-xl font-bold">Novos cadastros por semana</CardTitle>
            <CardDescription className="text-gray-500 font-medium">
              Entrada de novas barbearias nas últimas 8 semanas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.signups}>
                <defs>
                  <linearGradient id="engSignup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="cadastros" stroke="#10b981" strokeWidth={3} fill="url(#engSignup)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass border-white/5 rounded-3xl shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Novos clientes (30d)</p>
              <p className="text-2xl font-black text-white">{data.newCustomers30}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5 rounded-3xl shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Contas inativas (30d)</p>
              <p className="text-2xl font-black text-white">{data.inactive}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5 rounded-3xl shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gold/10 text-gold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ativos 30 dias</p>
              <p className="text-2xl font-black text-white">{data.mau}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
