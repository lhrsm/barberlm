import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarbexPageHeader } from "@/components/ui/barbex/BarbexPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Wrench, AlertOctagon, Activity, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/status")({
  component: AdminStatusPage,
});

type Status = "operational" | "degraded" | "partial" | "down" | "maintenance";

function AdminStatusPage() {
  const [services, setServices] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [maints, setMaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const [incOpen, setIncOpen] = useState(false);
  const [mntOpen, setMntOpen] = useState(false);
  const [incForm, setIncForm] = useState({ title: "", description: "", severity: "minor", affected: "" });
  const [mntForm, setMntForm] = useState({ title: "", description: "", impact: "low", scheduled_start: "", scheduled_end: "", affected: "" });

  const load = async () => {
    const [s, i, m] = await Promise.all([
      supabase.from("status_services").select("*").order("display_order"),
      supabase.from("status_incidents").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("status_maintenances").select("*").order("scheduled_start", { ascending: false }).limit(50),
    ]);
    setServices((s.data as any) || []);
    setIncidents((i.data as any) || []);
    setMaints((m.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateServiceStatus = async (id: string, manual_status: Status | null) => {
    const { error } = await supabase.from("status_services").update({ manual_status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status atualizado"); load(); }
  };

  const runHealthCheck = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/public/hooks/status-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Verificação executada");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const createIncident = async () => {
    if (!incForm.title) return;
    const { error } = await supabase.from("status_incidents").insert({
      title: incForm.title, description: incForm.description, severity: incForm.severity,
      affected_services: incForm.affected.split(",").map(s => s.trim()).filter(Boolean),
    });
    if (error) toast.error(error.message);
    else { toast.success("Incidente criado"); setIncOpen(false); setIncForm({ title: "", description: "", severity: "minor", affected: "" }); load(); }
  };

  const resolveIncident = async (id: string) => {
    const { error } = await supabase.from("status_incidents").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Incidente resolvido"); load(); }
  };

  const deleteIncident = async (id: string) => {
    if (!confirm("Excluir este incidente?")) return;
    await supabase.from("status_incidents").delete().eq("id", id); load();
  };

  const createMaintenance = async () => {
    if (!mntForm.title || !mntForm.scheduled_start || !mntForm.scheduled_end) return;
    const { error } = await supabase.from("status_maintenances").insert({
      title: mntForm.title, description: mntForm.description, impact: mntForm.impact,
      scheduled_start: mntForm.scheduled_start, scheduled_end: mntForm.scheduled_end,
      affected_services: mntForm.affected.split(",").map(s => s.trim()).filter(Boolean),
    });
    if (error) toast.error(error.message);
    else { toast.success("Manutenção agendada"); setMntOpen(false); setMntForm({ title: "", description: "", impact: "low", scheduled_start: "", scheduled_end: "", affected: "" }); load(); }
  };

  const deleteMaintenance = async (id: string) => {
    if (!confirm("Excluir esta manutenção?")) return;
    await supabase.from("status_maintenances").delete().eq("id", id); load();
  };

  return (
    <div>
      <BarbexPageHeader
        title="Central de Status"
        subtitle="Gerencie serviços, incidentes e manutenções programadas"
        actions={
          <Button onClick={runHealthCheck} disabled={running} size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Verificar agora
          </Button>
        }
      />

      {loading ? <p className="text-slate-400">Carregando...</p> : (
        <div className="space-y-10">
          {/* Services */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-yellow-400" />Serviços</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map(svc => (
                <div key={svc.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{svc.name}</p>
                    <span className="text-xs text-slate-500">{svc.slug}</span>
                  </div>
                  <Label className="text-xs text-slate-400">Override manual</Label>
                  <Select value={svc.manual_status || "auto"} onValueChange={(v) => updateServiceStatus(svc.id, v === "auto" ? null : v as Status)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático (monitoramento)</SelectItem>
                      <SelectItem value="operational">🟢 Operacional</SelectItem>
                      <SelectItem value="degraded">🟡 Lentidão</SelectItem>
                      <SelectItem value="partial">🟠 Instabilidade</SelectItem>
                      <SelectItem value="down">🔴 Indisponível</SelectItem>
                      <SelectItem value="maintenance">⚪ Em manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/* Incidents */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><AlertOctagon className="h-5 w-5 text-red-400" />Incidentes</h2>
              <Dialog open={incOpen} onOpenChange={setIncOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar incidente</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Título</Label><Input value={incForm.title} onChange={e => setIncForm({ ...incForm, title: e.target.value })} /></div>
                    <div><Label>Descrição</Label><Textarea value={incForm.description} onChange={e => setIncForm({ ...incForm, description: e.target.value })} /></div>
                    <div><Label>Severidade</Label>
                      <Select value={incForm.severity} onValueChange={v => setIncForm({ ...incForm, severity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minor">Menor</SelectItem>
                          <SelectItem value="major">Maior</SelectItem>
                          <SelectItem value="critical">Crítico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Serviços afetados (slugs separados por vírgula)</Label><Input value={incForm.affected} onChange={e => setIncForm({ ...incForm, affected: e.target.value })} placeholder="api, whatsapp" /></div>
                  </div>
                  <DialogFooter><Button onClick={createIncident}>Criar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {incidents.length === 0 && <p className="text-sm text-slate-500">Sem incidentes registrados.</p>}
              {incidents.map(inc => (
                <div key={inc.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{inc.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inc.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                        {inc.status === "resolved" ? "Resolvido" : inc.status}
                      </span>
                    </div>
                    {inc.description && <p className="text-sm text-slate-400">{inc.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">{new Date(inc.started_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {inc.status !== "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => resolveIncident(inc.id)} className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Resolver</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteIncident(inc.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Maintenances */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Wrench className="h-5 w-5 text-yellow-400" />Manutenções programadas</h2>
              <Dialog open={mntOpen} onOpenChange={setMntOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Agendar manutenção</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Título</Label><Input value={mntForm.title} onChange={e => setMntForm({ ...mntForm, title: e.target.value })} /></div>
                    <div><Label>Descrição</Label><Textarea value={mntForm.description} onChange={e => setMntForm({ ...mntForm, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Início</Label><Input type="datetime-local" value={mntForm.scheduled_start} onChange={e => setMntForm({ ...mntForm, scheduled_start: e.target.value })} /></div>
                      <div><Label>Fim</Label><Input type="datetime-local" value={mntForm.scheduled_end} onChange={e => setMntForm({ ...mntForm, scheduled_end: e.target.value })} /></div>
                    </div>
                    <div><Label>Impacto</Label>
                      <Select value={mntForm.impact} onValueChange={v => setMntForm({ ...mntForm, impact: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixo</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="high">Alto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Serviços afetados (slugs)</Label><Input value={mntForm.affected} onChange={e => setMntForm({ ...mntForm, affected: e.target.value })} placeholder="database, api" /></div>
                  </div>
                  <DialogFooter><Button onClick={createMaintenance}>Agendar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {maints.length === 0 && <p className="text-sm text-slate-500">Nenhuma manutenção registrada.</p>}
              {maints.map(m => (
                <div key={m.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{m.title}</p>
                    {m.description && <p className="text-sm text-slate-400">{m.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(m.scheduled_start).toLocaleString("pt-BR")} → {new Date(m.scheduled_end).toLocaleString("pt-BR")} · Impacto: {m.impact}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteMaintenance(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
