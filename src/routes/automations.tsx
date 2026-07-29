
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Zap, 
  RefreshCw,
  Loader2,
  Play,
  Settings2,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RotateCcw,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  SendHorizontal,
  Search,
  Filter,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  Smartphone,
  Check,
  CheckCheck,
  FileCode,
  Terminal,
  Activity,
  ArrowRight,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Code2,
  Info,
  MousePointer2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PremiumTabs,
  PremiumTabsList,
  PremiumTabsBody,
  PremiumTabsContent,
} from "@/components/ui/premium-tabs";
import { BarChart3, ListChecks } from "lucide-react";
import { AutomationEditModal } from "@/components/admin/automations/AutomationEditModal";
import { AutomationTestModal } from "@/components/admin/automations/AutomationTestModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { withModule } from "@/components/modules/withModule";

// Casting to any to bypass type errors for new table
const anySupabase = supabase as any;

export const Route = createFileRoute("/automations")({
  component: withModule("automations", "Automações", AutomationsComponent),
});

function AutomationsComponent() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, lastRun: null });
  const [logStats, setLogStats] = useState({ sent: 0, success: 0, failed: 0, lastSent: null, duplicateBlocked: 0, notFound: 0, pendingCallbacks: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [lastManualUpdate, setLastManualUpdate] = useState<Date | null>(null);
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId, currentPage, filterStatus, filterPeriod]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // 1. Fetch automations
      const { data: automationsData } = await anySupabase
        .from("automation_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      
      setAutomations(automationsData || []);

      // 2. Fetch queue stats
      const { data: qData } = await anySupabase.rpc('get_automation_queue_stats', { p_tenant_id: tenantId });
      if (qData) setQueueStats(qData);

      // 3. Fetch logs
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      let query = anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact' }).eq("tenant_id", tenantId);
      
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (searchTerm) query = query.or(`phone.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      
      const { data: logsData, count } = await query.order("sent_at", { ascending: false }).range(from, to);
      setLogs(logsData || []);
      setTotalLogs(count || 0);

      // 4. Global stats
      const { count: totalSuccess } = await anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "sent");
      const { count: totalFailed } = await anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "error");
      setLogStats(prev => ({ ...prev, success: totalSuccess || 0, failed: totalFailed || 0 }));

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const runQueueNow = async () => {
    setIsProcessingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: { tenant_id: tenantId }
      });
      if (error) throw error;
      toast.success("Fila processada com sucesso!");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao processar fila: " + e.message);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const runDiagnosis = async () => {
    setDiagLoading(true);
    setIsDiagOpen(true);
    try {
      // 1. Get last appointment
      const { data: appointment } = await anySupabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name),
          barber:barbers!appointments_barber_id_fkey(name)
        `)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (!appointment) throw new Error("Nenhum agendamento encontrado.");

      // 2. Check queue
      const { data: queue } = await anySupabase
        .from("automation_queue")
        .select("*")
        .eq("appointment_id", appointment.id)
        .maybeSingle();

      // 3. Check logs
      const { data: logs } = await anySupabase
        .from("automation_logs")
        .select("*")
        .eq("appointment_id", appointment.id)
        .order("created_at", { ascending: false });

      // 4. Check profile
      const { data: profile } = await anySupabase
        .from("profiles")
        .select("whatsapp_enabled, whatsapp_instance_id")
        .eq("id", tenantId)
        .single();

      setDiagData({
        appointment,
        queue,
        logs: logs || [],
        whatsapp: {
          enabled: profile?.whatsapp_enabled,
          instance: profile?.whatsapp_instance_id
        }
      });
    } catch (e: any) {
      toast.error("Erro no diagnóstico: " + e.message);
    } finally {
      setDiagLoading(false);
    }
  };

  const reprocessQueueItem = async (appointmentId: string) => {
    toast.info("Reprocessando...");
    try {
      const { error } = await supabase.functions.invoke('process-automation-queue', {
        body: { appointment_id: appointmentId, force_resend: true }
      });
      if (error) throw error;
      toast.success("Comando enviado!");
      fetchData();
      if (isDiagOpen) runDiagnosis();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Automações</h1>
            <p className="text-slate-500 font-medium text-sm">Gerencie disparos automáticos e auditoria de mensagens.</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <Button onClick={runDiagnosis} className="flex-1 lg:flex-none relative overflow-hidden group/diag rounded-xl h-12 px-6 bg-gradient-to-r from-gold to-[#F0D67B] text-black font-black uppercase tracking-wider text-xs border border-gold shadow-[0_6px_20px_-6px_rgba(212,175,55,0.7)] hover:shadow-[0_10px_28px_-8px_rgba(212,175,55,0.95)] transition-all duration-300">
              <span className="absolute inset-0 -translate-x-full group-hover/diag:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              <Search className="mr-2 h-4 w-4" /> Diagnosticar Último
            </Button>

            <Button onClick={runQueueNow} disabled={isProcessingQueue} className="flex-1 lg:flex-none bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs h-12 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              {isProcessingQueue ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4 fill-current" />} Processar Fila Agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Fila Pendente</p>
            <p className="text-2xl font-black text-amber-500">{queueStats.pending}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Sucessos</p>
            <p className="text-2xl font-black text-emerald-500">{logStats.success}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Falhas</p>
            <p className="text-2xl font-black text-rose-500">{logStats.failed}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Última Execução</p>
            <p className="text-sm font-bold text-white">{queueStats.lastRun ? new Date(queueStats.lastRun).toLocaleString() : '---'}</p>
          </Card>
        </div>

          
        <PremiumTabs defaultValue="active" className="space-y-0">
          <PremiumTabsList
            tabs={[
              { value: "active", label: "Ativas", icon: Zap },
              { value: "history", label: "Histórico", icon: History },
              { value: "logs", label: "Logs", icon: Terminal },
              { value: "stats", label: "Estatísticas", icon: BarChart3 },
            ]}
          />
          <PremiumTabsBody>
            <PremiumTabsContent value="active">
              {(() => {
                const CATEGORY_LABELS: Record<string, string> = {
                  agendamentos: "Agendamentos",
                  assinaturas: "Assinaturas",
                  financeiro: "Financeiro",
                  fidelidade: "Fidelidade",
                  marketing: "Marketing",
                };
                const RECIPIENT_LABELS: Record<string, { label: string; cls: string }> = {
                  customer: { label: "Cliente", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
                  barber: { label: "Barbeiro", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
                  shop: { label: "Barbearia", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
                };
                const grouped = automations.reduce((acc: Record<string, any[]>, a: any) => {
                  const cat = a.category || "agendamentos";
                  (acc[cat] ||= []).push(a);
                  return acc;
                }, {});
                const catOrder = ["agendamentos", "assinaturas", "financeiro", "fidelidade", "marketing"];
                const toggleActive = async (auto: any, next: boolean) => {
                  setAutomations((prev) => prev.map((x) => (x.id === auto.id ? { ...x, active: next } : x)));
                  const { error } = await anySupabase.from("automation_templates").update({ active: next }).eq("id", auto.id);
                  if (error) {
                    toast.error("Erro ao atualizar: " + error.message);
                    setAutomations((prev) => prev.map((x) => (x.id === auto.id ? { ...x, active: !next } : x)));
                  } else {
                    toast.success(next ? "Ativada" : "Desativada");
                  }
                };
                return (
                  <div className="space-y-8">
                    {catOrder.filter((c) => grouped[c]?.length).map((cat) => (
                      <div key={cat}>
                        <h2 className="text-xs font-black uppercase tracking-widest text-amber-500 mb-3">{CATEGORY_LABELS[cat]}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {grouped[cat].map((auto: any) => {
                            const rec = RECIPIENT_LABELS[auto.recipient || "customer"];
                            return (
                              <Card
                                key={auto.id}
                                className={`relative overflow-hidden rounded-2xl border transition-all ${
                                  auto.active
                                    ? "bg-gradient-to-b from-[#101a2e] to-[#0b1220] border-amber-500/30 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_10px_30px_-15px_rgba(245,158,11,0.4)]"
                                    : "bg-[#0F172A] border-white/10 hover:border-white/20"
                                }`}
                              >
                                {auto.active && (
                                  <span className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-amber-400 to-amber-600" />
                                )}
                                <div className="p-4 border-b border-white/5 space-y-2.5">
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="min-w-0 flex-1 text-sm font-black text-white uppercase tracking-tight leading-tight break-words">
                                      {auto.name}
                                    </h3>
                                    <Switch
                                      checked={!!auto.active}
                                      onCheckedChange={(v) => toggleActive(auto, v)}
                                      className="shrink-0 mt-0.5 h-6 w-11 border-2 data-[state=unchecked]:bg-slate-700 data-[state=unchecked]:border-slate-500/60 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-400 shadow-inner"
                                      thumbClassName="h-5 w-5 bg-white data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 shadow-md"
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className={`text-[10px] font-bold ${rec.cls}`}>{rec.label}</Badge>
                                    <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/30 font-mono">
                                      {auto.trigger_event}
                                    </Badge>
                                    {(() => {
                                      const preAppt = new Set([
                                        "appointment.created","appointment.confirmed","appointment.reminder",
                                        "appointment.whatsapp_confirmation","appointment.rescheduled",
                                        "appointment.rescheduled.by_customer","appointment.rescheduled.by_barber","appointment.rescheduled.by_shop",
                                        "appointment.cancelled","appointment.cancelled.by_customer","appointment.cancelled.by_barber","appointment.cancelled.by_shop",
                                        "appointment.professional_changed",
                                      ]);
                                      const walkinOk = !preAppt.has(auto.trigger_event);
                                      return (
                                        <>
                                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30" title="Aplica-se a agendamentos online">
                                            ✓ Online
                                          </Badge>
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] ${walkinOk ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-rose-500/10 text-rose-300 border-rose-500/30"}`}
                                            title={walkinOk ? "Executa em atendimentos presenciais" : "Não executa em atendimentos presenciais (cliente já está na barbearia)"}
                                          >
                                            {walkinOk ? "✓" : "✗"} Presencial
                                          </Badge>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <CardContent className="p-4">
                                  <p className="text-[11px] text-slate-400 line-clamp-3 italic mb-3 min-h-[3.3em]">"{auto.template}"</p>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setSelectedAutomation(auto); setIsEditOpen(true); }}>
                                      <Settings2 className="mr-1 h-3 w-3" /> Editar
                                    </Button>
                                    <Button size="sm" className="flex-1 bg-amber-500 text-black hover:bg-amber-600 text-xs" onClick={() => { setSelectedAutomation(auto); setIsTestOpen(true); }}>
                                      <Play className="mr-1 h-3 w-3" /> Testar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>

                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </PremiumTabsContent>


            <PremiumTabsContent value="history">
              <div className="space-y-3">
                {logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-4 rounded-2xl bg-[#0F172A] border border-white/5 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{log.customer_name || log.phone}</p>
                      <p className="text-xs text-slate-500">{new Date(log.sent_at || log.created_at).toLocaleString()}</p>
                    </div>
                    <Badge className={log.status === 'sent' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center text-slate-500 py-12">Sem execuções registradas ainda.</p>
                )}
              </div>
            </PremiumTabsContent>

            <PremiumTabsContent value="logs">
              <Card className="bg-[#0F172A] border-white/5">
                <div className="p-4 border-b border-white/5 flex gap-4 overflow-x-auto">
                  <Input
                    placeholder="Buscar destinatário..."
                    className="max-w-xs"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-white/5 text-slate-300">
                          <td className="p-4">{new Date(log.sent_at || log.created_at).toLocaleString()}</td>
                          <td className="p-4">
                            <p className="font-bold">{log.customer_name}</p>
                            <p className="text-xs text-slate-500">{log.phone}</p>
                          </td>
                          <td className="p-4">
                            <Badge className={log.status === 'sent' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="p-4 max-w-xs truncate">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </PremiumTabsContent>

            <PremiumTabsContent value="stats">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[#0F172A] border-white/5 p-5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Sucessos</p>
                  <p className="text-3xl font-black text-emerald-500">{logStats.success}</p>
                </Card>
                <Card className="bg-[#0F172A] border-white/5 p-5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Falhas</p>
                  <p className="text-3xl font-black text-rose-500">{logStats.failed}</p>
                </Card>
                <Card className="bg-[#0F172A] border-white/5 p-5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Pendentes</p>
                  <p className="text-3xl font-black text-amber-500">{queueStats.pending}</p>
                </Card>
                <Card className="bg-[#0F172A] border-white/5 p-5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Bloqueados</p>
                  <p className="text-3xl font-black text-white">{logStats.duplicateBlocked}</p>
                </Card>
              </div>
              <div className="mt-6 rounded-2xl bg-[#0F172A] border border-white/5 p-6">
                <p className="text-xs uppercase font-bold text-slate-500 mb-2">Taxa de sucesso</p>
                <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all"
                    style={{
                      width: `${
                        logStats.success + logStats.failed > 0
                          ? Math.round((logStats.success / (logStats.success + logStats.failed)) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </PremiumTabsContent>
          </PremiumTabsBody>
        </PremiumTabs>


        {isEditOpen && selectedAutomation && (
          <AutomationEditModal 
            isOpen={isEditOpen} 
            onClose={() => setIsEditOpen(false)} 
            automation={selectedAutomation} 
            onSave={fetchData}
          />
        )}
        
        {isTestOpen && selectedAutomation && (
          <AutomationTestModal 
            isOpen={isTestOpen} 
            onClose={() => setIsTestOpen(false)} 
            automation={selectedAutomation} 
          />
        )}

        <Dialog open={isDiagOpen} onOpenChange={setIsDiagOpen}>
          <DialogContent className="max-w-2xl bg-[#0F172A] border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">Diagnóstico de Automação</DialogTitle>
            </DialogHeader>

            {diagLoading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                <p className="text-slate-400 font-bold animate-pulse">Analisando agendamento real...</p>
              </div>
            ) : diagData ? (
              <div className="space-y-6">
                {/* 1. Appointment Info */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center">
                    <CalendarIcon className="h-3 w-3 mr-1" /> Último Agendamento
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Status</p>
                      <Badge className={diagData.appointment.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"}>
                        {diagData.appointment.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Horário</p>
                      <p className="text-sm font-bold">{new Date(diagData.appointment.start_time).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Cliente</p>
                      <p className="text-sm font-bold">{diagData.appointment.customer?.name || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500">{diagData.appointment.customer?.phone || 'Sem telefone'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Token Gerenciamento</p>
                      <p className="text-[10px] font-mono break-all text-amber-500">{diagData.appointment.management_token || 'NÃO GERADO'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Queue Status */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center">
                    <Activity className="h-3 w-3 mr-1" /> Status da Fila
                  </h4>
                  {diagData.queue ? (
                    <div className="flex justify-between items-center">
                      <div>
                        <Badge className={cn(
                          "uppercase text-[10px]",
                          diagData.queue.status === 'success' ? "bg-emerald-500/10 text-emerald-500" :
                          diagData.queue.status === 'failed' ? "bg-rose-500/10 text-rose-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>
                          {diagData.queue.status}
                        </Badge>
                        <p className="text-[10px] text-slate-500 mt-1">Tentativas: {diagData.queue.attempts}</p>
                      </div>
                      <Button size="sm" onClick={() => reprocessQueueItem(diagData.appointment.id)} className="bg-amber-500 text-black hover:bg-amber-600 font-bold">
                        <RotateCcw className="h-3 w-3 mr-1" /> Forçar Disparo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center">
                      <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
                      <p className="text-sm font-bold text-rose-500">Agendamento não entrou na fila!</p>
                      <p className="text-[10px] text-slate-500">A trigger não disparou ou os critérios não foram atendidos.</p>
                      <Button size="sm" onClick={() => reprocessQueueItem(diagData.appointment.id)} className="mt-4 bg-white/10 hover:bg-white/20 text-white font-bold">
                        Criar e Enviar Agora
                      </Button>
                    </div>
                  )}
                  {diagData.queue?.error_message && (
                    <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded text-[10px] text-rose-500 font-mono">
                      ERRO: {diagData.queue.error_message}
                    </div>
                  )}
                </div>

                {/* 3. Integration Status */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center">
                    <Smartphone className="h-3 w-3 mr-1" /> Integração WhatsApp
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", diagData.whatsapp.enabled ? "bg-emerald-500" : "bg-rose-500")} />
                      <span className="text-xs font-bold">{diagData.whatsapp.enabled ? "Ativada" : "Desativada"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", diagData.whatsapp.instance ? "bg-emerald-500" : "bg-rose-500")} />
                      <span className="text-xs font-bold">{diagData.whatsapp.instance ? "Instância OK" : "Sem Instância"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Logs */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center">
                    <History className="h-3 w-3 mr-1" /> Logs de Auditoria
                  </h4>
                  <div className="space-y-2">
                    {diagData.logs.length > 0 ? (
                      diagData.logs.map((log: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2 last:border-0">
                          <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                          <Badge className={cn(
                            "text-[8px] uppercase",
                            log.status === 'success' || log.status === 'sent' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>
                            {log.status}
                          </Badge>
                          <span className="text-slate-400 truncate max-w-[200px]">{log.error_message || log.payload?.diagnostic || 'Log gerado'}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">Nenhum log de auditoria encontrado.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center p-8 text-slate-500">Ocorreu um erro ao carregar os dados.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default AutomationsComponent;
