import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Clock,
  ArrowLeft, Server, Database, Zap, CreditCard, MessageCircle, HardDrive,
  Upload, Bell, Bot, Sparkles, Globe, Shield, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status da Plataforma — Barbex" },
      { name: "description", content: "Acompanhe em tempo real a disponibilidade dos serviços e integrações do Barbex." },
      { property: "og:title", content: "Status da Plataforma Barbex" },
      { property: "og:description", content: "Disponibilidade, incidentes e manutenções em tempo real." },
    ],
  }),
  component: StatusPage,
});

type Status = "operational" | "degraded" | "partial" | "down" | "maintenance";

interface Service {
  id: string; slug: string; name: string; category: string;
  description: string | null; display_order: number;
  manual_status: Status | null;
}
interface Check {
  id: number; service_id: string; status: Status; latency_ms: number | null;
  success: boolean; checked_at: string;
}
interface Incident {
  id: string; title: string; description: string | null; severity: string;
  status: string; affected_services: string[]; started_at: string; resolved_at: string | null;
}
interface Maintenance {
  id: string; title: string; description: string | null; impact: string;
  scheduled_start: string; scheduled_end: string; affected_services: string[]; status: string;
}

const STATUS_META: Record<Status, { label: string; color: string; dot: string; bg: string; border: string; icon: any }> = {
  operational: { label: "Operacional", color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 },
  degraded:    { label: "Lentidão",    color: "text-yellow-400", dot: "bg-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: Clock },
  partial:     { label: "Instabilidade", color: "text-orange-400", dot: "bg-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: AlertTriangle },
  down:        { label: "Indisponível", color: "text-red-400",    dot: "bg-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    icon: AlertOctagon },
  maintenance: { label: "Manutenção",   color: "text-slate-300",  dot: "bg-slate-300",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  icon: Wrench },
};

const SERVICE_ICONS: Record<string, any> = {
  frontend: Globe, "admin-panel": Server, "client-portal": Shield, "barber-panel": Server,
  api: Activity, database: Database, realtime: Zap, stripe: CreditCard,
  whatsapp: MessageCircle, storage: HardDrive, uploads: Upload,
  notifications: Bell, automations: Bot, ai: Sparkles,
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function computeUptime(checks: Check[], days: number): number {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const window = checks.filter(c => new Date(c.checked_at).getTime() >= since);
  if (window.length === 0) return 100;
  const ok = window.filter(c => c.success).length;
  return Math.round((ok / window.length) * 10000) / 100;
}

function StatusPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [s, c, i, m] = await Promise.all([
      supabase.from("status_services").select("*").eq("enabled", true).order("display_order"),
      supabase.from("status_checks").select("*").gte("checked_at", since).order("checked_at", { ascending: false }).limit(5000),
      supabase.from("status_incidents").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("status_maintenances").select("*").gte("scheduled_end", new Date().toISOString()).order("scheduled_start").limit(10),
    ]);
    setServices((s.data as any) || []);
    setChecks((c.data as any) || []);
    setIncidents((i.data as any) || []);
    setMaintenances((m.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const serviceStatus = useMemo(() => {
    const map: Record<string, { status: Status; latency: number | null; last: string | null; checks: Check[] }> = {};
    services.forEach(svc => {
      const own = checks.filter(c => c.service_id === svc.id);
      const last = own[0];
      const status: Status = (svc.manual_status as Status) || (last?.status as Status) || "operational";
      map[svc.id] = { status, latency: last?.latency_ms ?? null, last: last?.checked_at ?? null, checks: own };
    });
    return map;
  }, [services, checks]);

  const overall: Status = useMemo(() => {
    const values = Object.values(serviceStatus).map(s => s.status);
    if (values.includes("down")) return "down";
    if (values.includes("partial")) return "partial";
    if (values.includes("degraded")) return "degraded";
    if (values.includes("maintenance")) return "maintenance";
    return "operational";
  }, [serviceStatus]);

  const overallMeta = STATUS_META[overall];
  const OverallIcon = overallMeta.icon;

  const categories = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    services.forEach(s => { (groups[s.category] ||= []).push(s); });
    return groups;
  }, [services]);

  const categoryLabels: Record<string, string> = {
    apps: "Aplicações", core: "Infraestrutura Principal", integrations: "Integrações",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Ambient gradient */}
      <div className="absolute inset-x-0 top-0 h-[500px] pointer-events-none opacity-40"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(234,179,8,0.15) 0%, transparent 70%)" }}
      />

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-yellow-400 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-yellow-400 transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-yellow-500/40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {/* Hero */}
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Activity className="h-3.5 w-3.5" /> Status da Plataforma
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 tracking-tight">Status da Plataforma Barbex</h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Acompanhe em tempo real a disponibilidade dos nossos serviços e integrações.
          </p>

          {/* Overall banner */}
          <div className={`mt-8 rounded-2xl border ${overallMeta.border} ${overallMeta.bg} backdrop-blur-sm p-6 flex items-center gap-4`}>
            <div className={`relative h-14 w-14 rounded-full ${overallMeta.bg} border ${overallMeta.border} flex items-center justify-center`}>
              <OverallIcon className={`h-7 w-7 ${overallMeta.color}`} />
              <span className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ${overallMeta.dot} animate-pulse`} />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Status geral</p>
              <p className={`text-2xl font-bold ${overallMeta.color}`}>
                {overall === "operational" ? "Todos os sistemas operacionais" :
                 overall === "degraded" ? "Lentidão detectada em alguns serviços" :
                 overall === "partial" ? "Degradação parcial detectada" :
                 overall === "down" ? "Interrupção detectada" : "Manutenção em andamento"}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Carregando status...</div>
        ) : (
          <>
            {/* Services by category */}
            {Object.entries(categories).map(([cat, list]) => (
              <section key={cat} aria-labelledby={`cat-${cat}`} className="mb-10">
                <h2 id={`cat-${cat}`} className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                  {categoryLabels[cat] || cat}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {list.map(svc => {
                    const st = serviceStatus[svc.id];
                    const meta = STATUS_META[st.status];
                    const Icon = SERVICE_ICONS[svc.slug] || Server;
                    const up7 = computeUptime(st.checks, 7);
                    return (
                      <div key={svc.id} className={`rounded-xl border ${meta.border} bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`h-10 w-10 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-5 w-5 ${meta.color}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{svc.name}</p>
                              {svc.description && <p className="text-xs text-slate-500 truncate">{svc.description}</p>}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.color} shrink-0`}>
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider">Latência</p>
                            <p className="text-slate-300 font-mono">{st.latency != null ? `${st.latency} ms` : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider">Uptime 7d</p>
                            <p className="text-slate-300 font-mono">{up7}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider">Última verificação</p>
                            <p className="text-slate-300 font-mono">{st.last ? fmtTime(st.last) : "—"}</p>
                          </div>
                        </div>
                        {/* 30-bar mini history */}
                        <div className="mt-3 flex items-end gap-0.5 h-6">
                          {Array.from({ length: 30 }).map((_, i) => {
                            const dayStart = Date.now() - (29 - i) * 24 * 60 * 60 * 1000;
                            const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                            const day = st.checks.filter(c => {
                              const t = new Date(c.checked_at).getTime();
                              return t >= dayStart && t < dayEnd;
                            });
                            let cls = "bg-white/5";
                            if (day.length > 0) {
                              const fails = day.filter(c => !c.success).length;
                              const pct = fails / day.length;
                              if (pct === 0) cls = "bg-emerald-500/70";
                              else if (pct < 0.05) cls = "bg-yellow-500/70";
                              else if (pct < 0.2) cls = "bg-orange-500/70";
                              else cls = "bg-red-500/70";
                            }
                            return <div key={i} className={`flex-1 rounded-sm ${cls}`} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* Uptime summary */}
            <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Disponibilidade global</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Hoje", days: 1 }, { label: "7 dias", days: 7 },
                  { label: "30 dias", days: 30 }, { label: "90 dias", days: 90 },
                ].map(p => {
                  const all = checks;
                  const pct = computeUptime(all, p.days);
                  return (
                    <div key={p.label} className="text-center p-4 rounded-xl border border-white/5 bg-black/30">
                      <p className="text-xs uppercase tracking-wider text-slate-500">{p.label}</p>
                      <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{pct.toFixed(2)}%</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Incidents */}
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Incidentes recentes</h2>
              {incidents.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <p className="text-sm text-slate-300">Sem incidentes registrados nos últimos dias. Tudo tranquilo por aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map(inc => {
                    const resolved = inc.status === "resolved" || !!inc.resolved_at;
                    const dur = inc.resolved_at
                      ? Math.round((new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime()) / 60000)
                      : null;
                    return (
                      <div key={inc.id} className={`rounded-xl border p-5 ${resolved ? "border-white/10 bg-white/[0.02]" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold">{inc.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resolved ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                            {resolved ? "Resolvido" : inc.status}
                          </span>
                        </div>
                        {inc.description && <p className="text-sm text-slate-400 mb-3">{inc.description}</p>}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                          <span>Início: <span className="text-slate-300">{fmtTime(inc.started_at)}</span></span>
                          {inc.resolved_at && <span>Fim: <span className="text-slate-300">{fmtTime(inc.resolved_at)}</span></span>}
                          {dur != null && <span>Duração: <span className="text-slate-300">{dur} min</span></span>}
                          {inc.affected_services.length > 0 && (
                            <span>Serviços: <span className="text-slate-300">{inc.affected_services.join(", ")}</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Maintenances */}
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Próximas manutenções</h2>
              {maintenances.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                  Nenhuma manutenção programada no momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenances.map(m => (
                    <div key={m.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-yellow-400" />
                          <h3 className="font-semibold">{m.title}</h3>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 capitalize">
                          Impacto: {m.impact}
                        </span>
                      </div>
                      {m.description && <p className="text-sm text-slate-400 mb-3">{m.description}</p>}
                      <div className="text-xs text-slate-500">
                        {fmtTime(m.scheduled_start)} → {fmtTime(m.scheduled_end)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <Link to="/privacy" className="hover:text-yellow-400">Política de Privacidade</Link>
              <Link to="/terms" className="hover:text-yellow-400">Termos</Link>
              <Link to="/accessibility" className="hover:text-yellow-400">Acessibilidade</Link>
              <Link to="/security" className="hover:text-yellow-400">Segurança</Link>
              <Link to="/status" className="hover:text-yellow-400">Status</Link>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
