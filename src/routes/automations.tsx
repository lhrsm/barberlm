
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { useEffect, useState } from "react";
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
  ChevronRight
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationEditModal } from "@/components/admin/automations/AutomationEditModal";
import { AutomationTestModal } from "@/components/admin/automations/AutomationTestModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Casting to any to bypass type errors for new table
const anySupabase = supabase as any;

export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

const DEFAULT_TEMPLATE = `Olá {customer_name} 👋

Seu agendamento na {barbershop_name} foi realizado com sucesso.

📋 Resumo do agendamento:

✅ Serviço: {service_name}
💈 Profissional: {professional_name}
📅 Data: {appointment_date}
⏰ Horário: {appointment_time}

O que deseja fazer?`;

function AutomationsComponent() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isLogDetailOpen, setIsLogDetailOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState("");
  
  // Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAutomation, setFilterAutomation] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  async function fetchData() {
    if (!tenantId) return;
    setLoading(true);
    try {
      // 1. Fetch automations from the new table
      const { data: automationsData, error: autoError } = await anySupabase
        .from("automation_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

      if (autoError) throw autoError;

      // 2. If no appointment confirmation exists, create it
      if (automationsData && !automationsData.find((a: any) => a.key === 'appointment_confirmation')) {
        const { data: newAuto, error: insertError } = await anySupabase
          .from("automation_templates")
          .insert({
            tenant_id: tenantId,
            key: 'appointment_confirmation',
            name: 'Confirmação de Agendamento',
            trigger_event: 'appointment.created',
            channel: 'whatsapp',
            active: true,
            template: DEFAULT_TEMPLATE,
            buttons: [
              { label: "Confirmar agendamento", action: "confirm" },
              { label: "Reagendar", action: "reschedule" },
              { label: "Cancelar", action: "cancel" }
            ]
          })
          .select()
          .single();
        
        if (!insertError && newAuto) {
          automationsData.push(newAuto);
        }
      }

      setAutomations(automationsData || []);

      // 3. Fetch logs with filtering and pagination
      let query = supabase
        .from("automation_logs")
        .select("*", { count: 'exact' })
        .eq("tenant_id", tenantId);
        
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      
      if (filterAutomation !== "all") {
        query = query.eq("message_type", filterAutomation);
      }
      
      if (filterPeriod !== "all") {
        const now = new Date();
        let startDate = new Date();
        if (filterPeriod === "today") {
          startDate.setHours(0, 0, 0, 0);
        } else if (filterPeriod === "7days") {
          startDate.setDate(now.getDate() - 7);
        } else if (filterPeriod === "30days") {
          startDate.setDate(now.getDate() - 30);
        }
        query = query.gte("created_at", startDate.toISOString());
      }
      
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data: logsData, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      setLogs(logsData || []);
      setTotalLogs(count || 0);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const replaceVariables = (template: string) => {
    return template
      .replace(/{customer_name}/g, "João Silva")
      .replace(/{barbershop_name}/g, "Barbex Premium")
      .replace(/{service_name}/g, "Corte + Barba")
      .replace(/{professional_name}/g, "Carlos (Mestre Barbeiro)")
      .replace(/{appointment_date}/g, "15/06/2026")
      .replace(/{appointment_time}/g, "14:30");
  };

  const openPreview = (template: string) => {
    setSelectedPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    if (tenantId) {
      setCurrentPage(1); // Reset to first page when filters change
      fetchData();
    }
  }, [filterStatus, filterAutomation, filterPeriod]);

  useEffect(() => {
    if (tenantId) fetchData();
  }, [currentPage]);

  const toggleStatus = async (automation: any) => {
    try {
      const { error } = await anySupabase
        .from("automation_templates")
        .update({ active: !automation.active })
        .eq("id", automation.id);

      if (error) throw error;
      toast.success(`Automação ${!automation.active ? 'ativada' : 'desativada'}!`);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const openEdit = (automation: any) => {
    setSelectedAutomation(automation);
    setIsEditOpen(true);
  };

  const openTest = (automation: any) => {
    setSelectedAutomation(automation);
    setIsTestOpen(true);
  };

  const resendTest = async (log: any) => {
    try {
      // Reenvio exclusivo para testes de Confirmação de Agendamento
      if (log.message_type !== 'appointment_confirmation') {
        toast.error("Reenvio disponível apenas para Confirmação de Agendamento");
        return;
      }

      setLoading(true);
      const { data: automation } = await anySupabase
        .from("automation_templates")
        .select("*")
        .eq("id", log.automation_id)
        .single();

      if (!automation) throw new Error("Automação não encontrada");

      const { data: zapiData, error: zapiError } = await supabase.functions.invoke('zapi-api', {
        body: {
          action: 'send-test-message',
          instanceId: (await supabase.from('whatsapp_instances').select('id').eq('tenant_id', tenantId || "").single()).data?.id,
          data: {
            phone: log.phone,
            message: log.processed_template || log.payload?.rendered || "Mensagem de reenvio"
          }
        }
      });

      if (zapiError) throw zapiError;

      const isSuccess = zapiData?.success === true;

      await (supabase as any).from("automation_logs").insert({
        automation_id: automation.id,
        tenant_id: tenantId,
        phone: log.phone,
        status: isSuccess ? "sent" : "error",
        message_type: automation.key,
        processed_template: log.processed_template || log.payload?.rendered,
        original_template: automation.template,
        provider: "zapi",
        sent_at: new Date().toISOString(),
        payload: { ...log.payload, resent: true },
        error_message: isSuccess ? null : (zapiData?.error || "Erro no reenvio"),
        response: zapiData?.result
      });

      if (isSuccess) toast.success("Reenviado com sucesso!");
      else toast.error("Falha ao reenviar: " + (zapiData?.error || "Erro desconhecido"));
      
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao reenviar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-white mb-2">
              Automações
            </h2>
            <p className="text-slate-400 max-w-xl leading-relaxed">
              Gerencie suas automações de atendimento, notificações e comunicações com clientes de forma profissional.
            </p>
          </div>
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="icon"
            className="border-slate-800 bg-[#0F172A] text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
          </Button>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="bg-[#0F172A] border border-slate-800 p-1 rounded-2xl w-fit">
            <TabsTrigger 
              value="templates" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
            >
              Modelos de Mensagem
            </TabsTrigger>
            <TabsTrigger 
              value="logs"
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
            >
              Histórico de Envios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4 pt-4">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {automations.map((auto) => (
                <Card 
                  key={auto.id} 
                  className="group relative flex flex-col bg-[#0F172A] border-[1px] border-amber-500/30 rounded-[20px] shadow-[0_10px_35px_rgba(0,0,0,0.35)] hover:border-amber-500/60 hover:shadow-[0_20px_45px_rgba(0,0,0,0.45)] transition-all duration-300 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/50"
                >
                  <CardHeader className="p-6 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] shadow-lg shadow-amber-600/20">
                          <Zap className="text-white" size={24} />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-xl md:text-[22px] font-bold text-white leading-tight truncate">
                            {auto.name}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge 
                              className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 border-none ${
                                auto.active 
                                  ? 'bg-emerald-500/15 text-emerald-400' 
                                  : 'bg-slate-500/15 text-slate-400'
                              }`}
                            >
                              {auto.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <Badge className="bg-amber-500/15 text-amber-500 text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 border-none">
                              <MessageCircle size={10} className="mr-1" /> WhatsApp
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Switch 
                        checked={auto.active || false} 
                        onCheckedChange={() => toggleStatus(auto)}
                        className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-slate-700 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
                        thumbClassName="data-[state=checked]:bg-slate-900"
                        aria-label={`Alternar status da automação ${auto.name}`}
                      />
                    </div>

                    <CardDescription className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2">
                      Envia automaticamente uma mensagem para o cliente após a criação de um agendamento.
                    </CardDescription>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-none text-[10px] font-mono py-0 px-2 h-5">
                        {auto.trigger_event}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-6 flex-1 flex flex-col gap-4">
                    <button 
                      onClick={() => openPreview(auto.template)}
                      className="w-full text-left bg-white/5 border border-white/10 rounded-[14px] p-4 relative group/preview hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      aria-label="Visualizar mensagem completa"
                    >
                      <p className="text-xs text-slate-300 italic whitespace-pre-wrap line-clamp-4 leading-relaxed">
                        {auto.template}
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium group-hover/preview:text-slate-300 transition-colors">Visualizar mensagem completa</span>
                        <ExternalLink size={10} className="text-slate-500 group-hover/preview:text-slate-300 transition-colors" />
                      </div>
                    </button>

                    <div className="grid grid-cols-3 gap-2 mt-auto border-t border-white/5 pt-4">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1 flex items-center justify-center gap-1">
                          <SendHorizontal size={10} /> Enviados
                        </p>
                        <p className="text-lg font-bold text-white leading-none">127</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1 flex items-center justify-center gap-1">
                          <AlertTriangle size={10} /> Falhas
                        </p>
                        <p className="text-lg font-bold text-rose-400 leading-none">2</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1 flex items-center justify-center gap-1">
                          <Clock size={10} /> Último Envio
                        </p>
                        <p className="text-[10px] font-medium text-slate-300 leading-tight">Hoje às 14:30</p>
                      </div>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-2 flex flex-col sm:flex-row gap-3 mt-auto">
                    <Button 
                      className="flex-1 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl h-11 shadow-lg focus-visible:ring-2 focus-visible:ring-amber-500"
                      onClick={() => openEdit(auto)}
                    >
                      <Settings2 size={16} className="mr-2" /> Editar
                    </Button>
                    <Button 
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl h-11 shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-amber-500"
                      onClick={() => openTest(auto)}
                    >
                      <Play size={16} className="mr-2 fill-current" /> Testar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            
            <p className="text-xs text-center text-muted-foreground mt-8">
              Novos modelos de automação serão liberados gradualmente por etapas.
            </p>
          </TabsContent>

          <TabsContent value="logs" className="pt-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <History size={18} /> Histórico de Envios
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Acompanhe as últimas mensagens enviadas pelo sistema.
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <Input 
                        placeholder="Buscar destinatário..." 
                        className="pl-9 w-[200px] bg-[#0F172A] border-slate-800 text-sm h-9 rounded-xl text-white focus:border-amber-500/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[140px] bg-[#0F172A] border-slate-800 text-sm h-9 rounded-xl text-white">
                        <Filter size={14} className="mr-2 text-slate-500" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="sent">Sucesso</SelectItem>
                        <SelectItem value="error">Falhas</SelectItem>
                        <SelectItem value="pending">Pendentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-[#0F172A]/50">
                  <table className="w-full text-sm">
                    <thead className="bg-[#0F172A] border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Data/Hora</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Automação</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Canal</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Destinatário</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Status</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {logs.filter(l => (l.phone || '').includes(searchTerm)).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {log.message_type === 'appointment_confirmation' ? 'Confirmação de Agendamento' : log.message_type}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {log.provider === 'zapi' ? 'WhatsApp' : log.provider}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {log.phone}
                          </td>
                          <td className="px-4 py-3">
                            {log.status === 'sent' ? (
                              <div className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 size={14} />
                                <span className="text-xs font-medium">Enviado</span>
                              </div>
                            ) : log.status === 'error' ? (
                              <div className="flex items-center gap-1.5 text-red-600" title={log.error_message}>
                                <XCircle size={14} />
                                <span className="text-xs font-medium">Falha</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-600">
                                <Clock size={14} />
                                <span className="text-xs font-medium">{log.status}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setIsLogDetailOpen(true);
                                }}
                                title="Ver Detalhes"
                              >
                                <Eye size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => resendTest(log)}
                                title="Reenviar"
                              >
                                <RotateCcw size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {logs.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      Nenhum envio registrado recentemente.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedAutomation && (
        <>
          <AutomationEditModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            automation={selectedAutomation}
            onSave={fetchData}
          />
          <AutomationTestModal
            isOpen={isTestOpen}
            onClose={() => setIsTestOpen(false)}
            automation={selectedAutomation}
          />
        </>
      )}

      <Dialog open={isLogDetailOpen} onOpenChange={setIsLogDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Envio</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID da Automação</p>
                  <p className="font-mono text-xs">{selectedLog.automation_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={selectedLog.status === 'sent' ? 'default' : 'destructive'}>
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Mensagem Processada</p>
                <div className="bg-slate-50 p-3 rounded-md border text-xs whitespace-pre-wrap italic">
                  {selectedLog.processed_template || selectedLog.payload?.rendered}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-1">Erro Completo</p>
                  <div className="bg-red-50 p-3 rounded-md border border-red-100 text-xs text-red-700 font-mono overflow-x-auto">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-1">Payload / Dados Técnicos</p>
                <div className="bg-slate-900 p-3 rounded-md text-[10px] text-amber-400 font-mono overflow-x-auto">
                  <pre>{JSON.stringify(selectedLog.payload || {}, null, 2)}</pre>
                  <p className="text-slate-400 mt-2">// Resposta da API</p>
                  <pre>{JSON.stringify(selectedLog.response || {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-md bg-[#0F172A] border-slate-800 text-white p-0 overflow-hidden rounded-[24px]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Eye className="text-amber-500" size={20} />
              Visualização da Mensagem
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 pt-2 space-y-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative">
              <div className="absolute top-0 right-4 -translate-y-1/2 bg-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-900 uppercase">
                WhatsApp Preview
              </div>
              
              <div className="mt-2 space-y-3">
                <div className="bg-[#075E54] text-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed relative">
                  {replaceVariables(selectedPreviewTemplate)}
                  <div className="text-[10px] text-white/60 text-right mt-1">
                    14:30 ✓✓
                  </div>
                </div>
                
                <div className="space-y-2 pt-2">
                  <div className="bg-white/10 hover:bg-white/20 transition-colors border border-white/10 p-2.5 rounded-xl text-center text-sm font-semibold text-white">
                    Confirmar agendamento
                  </div>
                  <div className="bg-white/10 hover:bg-white/20 transition-colors border border-white/10 p-2.5 rounded-xl text-center text-sm font-semibold text-white">
                    Reagendar
                  </div>
                  <div className="bg-white/10 hover:bg-white/20 transition-colors border border-white/10 p-2.5 rounded-xl text-center text-sm font-semibold text-white">
                    Cancelar
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 text-center px-4">
              As variáveis foram preenchidas com dados de exemplo para esta visualização.
            </p>
            
            <Button 
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl h-11"
              onClick={() => setIsPreviewOpen(false)}
            >
              Fechar Visualização
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default AutomationsComponent;
