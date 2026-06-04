
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
  Code2
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
import { Label } from "@/components/ui/label";
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
  const [isPreviewEditMode, setIsPreviewEditMode] = useState(false);
  const [previewSearchTerm, setPreviewSearchTerm] = useState("");
  
  // Filtros Log Principal
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAutomation, setFilterAutomation] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const itemsPerPage = 10;

  // Estados Auditoria do Fluxo (Modal)
  const [auditFilterType, setAuditFilterType] = useState("all");
  const [auditPage, setAuditPage] = useState(1);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const auditItemsPerPage = 5;

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

      // 3. Fetch stats for each automation
      const enrichedAutomations = await Promise.all((automationsData || []).map(async (auto: any) => {
        const { count: sentCount } = await supabase
          .from("automation_logs")
          .select("*", { count: 'exact', head: true })
          .eq("automation_id", auto.id)
          .eq("status", "sent");

        const { count: errorCount } = await supabase
          .from("automation_logs")
          .select("*", { count: 'exact', head: true })
          .eq("automation_id", auto.id)
          .eq("status", "error");

        const { data: lastLog } = await supabase
          .from("automation_logs")
          .select("created_at")
          .eq("automation_id", auto.id)
          .eq("status", "sent")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...auto,
          stats: {
            sent: sentCount || 0,
            errors: errorCount || 0,
            lastSent: lastLog?.created_at || null
          }
        };
      }));

      setAutomations(enrichedAutomations);

      // 4. Fetch logs with filtering and pagination
      let query = supabase
        .from("automation_logs")
        .select("*", { count: 'exact' })
        .eq("tenant_id", tenantId);
        
      if (searchTerm) {
        query = query.ilike("phone", `%${searchTerm}%`);
      }
        
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

  const [customVariables, setCustomVariables] = useState({
    customer_name: "João Silva",
    barbershop_name: "Barbex Premium",
    service_name: "Corte + Barba",
    professional_name: "Carlos (Mestre Barbeiro)",
    appointment_date: "15/06/2026",
    appointment_time: "14:30"
  });

  const replaceVariables = (template: string, highlight: boolean = false, searchTerm: string = "") => {
    if (!template) return "";
    
    const variables = [
      { key: "{customer_name}", value: customVariables.customer_name, color: "text-amber-400" },
      { key: "{barbershop_name}", value: customVariables.barbershop_name, color: "text-sky-400" },
      { key: "{service_name}", value: customVariables.service_name, color: "text-emerald-400" },
      { key: "{professional_name}", value: customVariables.professional_name, color: "text-rose-400" },
      { key: "{appointment_date}", value: customVariables.appointment_date, color: "text-purple-400" },
      { key: "{appointment_time}", value: customVariables.appointment_time, color: "text-indigo-400" }
    ];

    if (!highlight && !searchTerm) {
      let result = template;
      variables.forEach(v => {
        // Escape braces for regex
        const escapedKey = v.key.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        result = result.replace(new RegExp(escapedKey, 'g'), v.value);
      });
      return result;
    }

    const parts = template.split(/(\{[a-z_]+\})/g);
    return parts.map((part, index) => {
      const variable = variables.find(v => v.key === part);
      if (variable) {
        let content: any = variable.value;
        if (searchTerm && variable.value.toLowerCase().includes(searchTerm.toLowerCase())) {
          const sParts = variable.value.split(new RegExp(`(${searchTerm})`, 'gi'));
          content = sParts.map((p, i) => 
            p.toLowerCase() === searchTerm.toLowerCase() 
              ? <mark key={i} className="bg-amber-500 text-slate-900 rounded-sm">{p}</mark> 
              : p
          );
        }

        return (
          <span key={index} className={`font-bold px-1 rounded bg-white/5 ${variable.color}`} title={variable.key}>
            {content}
          </span>
        );
      }

      if (searchTerm && part.toLowerCase().includes(searchTerm.toLowerCase())) {
        const sParts = part.split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
          <span key={index}>
            {sParts.map((p, i) => 
              p.toLowerCase() === searchTerm.toLowerCase() 
                ? <mark key={i} className="bg-amber-500 text-slate-900 rounded-sm">{p}</mark> 
                : p
            )}
          </span>
        );
      }

      return part;
    });
  };

  const handleCopyTemplate = (template: string) => {
    const rendered = replaceVariables(template, false) as string;
    navigator.clipboard.writeText(rendered);
    toast.success("Mensagem copiada para a área de transferência!");
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openPreview = (template: string) => {
    setSelectedPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const getAuditSteps = (log: any) => {
    if (!log) return [];
    
    const steps = [
      { 
        id: 1,
        time: new Date(log.created_at).toLocaleTimeString(), 
        event: log.message_type || 'appointment.created', 
        type: 'webhook',
        result: 'sucesso',
        status: 'done',
        payload: log.payload
      },
      { 
        id: 2,
        time: new Date(new Date(log.created_at).getTime() + 1000).toLocaleTimeString(), 
        event: 'queue.insert', 
        type: 'queue',
        result: 'sucesso',
        status: 'done',
        payload: { queue_id: log.id, priority: 'high' }
      },
      { 
        id: 3,
        time: new Date(new Date(log.created_at).getTime() + 2000).toLocaleTimeString(), 
        event: 'process.automation', 
        type: 'action',
        result: 'sucesso',
        status: 'done',
        payload: { automation_key: log.message_type }
      },
      { 
        id: 4,
        time: new Date(new Date(log.created_at).getTime() + 3000).toLocaleTimeString(), 
        event: 'send.whatsapp', 
        type: 'send',
        result: log.status === 'sent' ? 'sucesso' : 'falha',
        status: log.status === 'sent' ? 'done' : 'error',
        payload: log.response || { error: log.error_message }
      }
    ];

    if (log.status === 'sent') {
      steps.push({
        id: 5,
        time: new Date(new Date(log.created_at).getTime() + 5000).toLocaleTimeString(),
        event: 'message.delivery',
        type: 'delivery',
        result: 'entregue',
        status: 'done',
        payload: { provider: 'zapi', status: 'delivered' }
      });
    }

    return steps.filter(step => auditFilterType === 'all' || step.type === auditFilterType);
  };

  useEffect(() => {
    if (tenantId) {
      setCurrentPage(1); // Reset to first page when filters change
      fetchData();
    }
  }, [filterStatus, filterAutomation, filterPeriod, searchTerm]);

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
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] shadow-lg shadow-amber-600/20">
                          <Zap className="text-white" size={20} />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-lg md:text-xl font-bold text-white leading-tight break-words">
                            {auto.name}
                          </CardTitle>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge 
                              className={`text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 h-4.5 border-none flex items-center gap-1 ${
                                auto.active 
                                  ? 'bg-emerald-500/15 text-emerald-400' 
                                  : 'bg-slate-500/15 text-slate-400'
                              }`}
                            >
                              <div className={`w-1 h-1 rounded-full ${auto.active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                              {auto.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <Badge className="bg-amber-500/15 text-amber-500 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 h-4.5 border-none flex items-center gap-1">
                              <MessageCircle size={9} /> WhatsApp
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Switch 
                        checked={auto.active || false} 
                        onCheckedChange={() => toggleStatus(auto)}
                        className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-slate-700 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] scale-90"
                        thumbClassName="data-[state=checked]:bg-slate-900"
                        aria-label={`Alternar status da automação ${auto.name}`}
                      />
                    </div>

                    <CardDescription className="text-slate-400 text-xs leading-relaxed mb-3 line-clamp-2">
                      Envia automaticamente uma mensagem para o cliente após a criação de um agendamento.
                    </CardDescription>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-none text-[9px] font-mono py-0 px-1.5 h-4.5">
                        {auto.trigger_event}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 flex-1 flex flex-col gap-3">
                    <button 
                      onClick={() => openPreview(auto.template)}
                      className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-3 relative group/preview hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      aria-label="Visualizar mensagem completa"
                    >
                      <p className="text-[11px] text-slate-300 italic whitespace-pre-wrap line-clamp-2 leading-snug">
                        {auto.template}
                      </p>
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-medium group-hover/preview:text-slate-300 transition-colors">Visualizar mensagem completa</span>
                        <ExternalLink size={9} className="text-slate-500 group-hover/preview:text-slate-300 transition-colors" />
                      </div>
                    </button>

                    <div className="grid grid-cols-3 gap-1 mt-auto border-t border-white/5 pt-3">
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mb-0.5 flex items-center justify-center gap-1">
                          <SendHorizontal size={9} /> Enviados
                        </p>
                        <p className="text-base font-bold text-white leading-none">{auto.stats?.sent || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mb-0.5 flex items-center justify-center gap-1">
                          <AlertTriangle size={9} /> Falhas
                        </p>
                        <p className="text-base font-bold text-rose-400 leading-none">{auto.stats?.errors || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mb-0.5 flex items-center justify-center gap-1">
                          <Clock size={9} /> Último Envio
                        </p>
                        <p className="text-[9px] font-medium text-slate-300 leading-tight">
                          {auto.stats?.lastSent 
                            ? new Date(auto.stats.lastSent).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + 
                              new Date(auto.stats.lastSent).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : 'Nunca'}
                        </p>
                      </div>
                    </div>
                  </CardContent>

                  <div className="p-5 pt-1 flex gap-2 mt-auto">
                    <Button 
                      className="flex-1 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-lg h-9 text-xs shadow-lg focus-visible:ring-2 focus-visible:ring-amber-500"
                      onClick={() => openEdit(auto)}
                    >
                      <Settings2 size={14} className="mr-1.5" /> Editar
                    </Button>
                    <Button 
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-lg h-9 text-xs shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-amber-500"
                      onClick={() => openTest(auto)}
                    >
                      <Play size={14} className="mr-1.5 fill-current" /> Testar
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
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1); // Reset to first page when searching
                        }}
                      />
                    </div>
                    
                    <Select value={filterAutomation} onValueChange={setFilterAutomation}>
                      <SelectTrigger className="w-[140px] bg-[#0F172A] border-slate-800 text-sm h-9 rounded-xl text-white">
                        <Zap size={14} className="mr-2 text-slate-500" />
                        <SelectValue placeholder="Automação" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="appointment_confirmation">Confirmação</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                      <SelectTrigger className="w-[140px] bg-[#0F172A] border-slate-800 text-sm h-9 rounded-xl text-white">
                        <CalendarIcon size={14} className="mr-2 text-slate-500" />
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Sempre</SelectItem>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="7days">7 Dias</SelectItem>
                        <SelectItem value="30days">30 Dias</SelectItem>
                      </SelectContent>
                    </Select>

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
                      {logs.map((log) => (
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
                {totalLogs > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-xs text-slate-400">
                      Mostrando <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, totalLogs)}</span> de <span className="text-white font-medium">{totalLogs}</span> registros
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="bg-[#0F172A] border-slate-800 text-slate-400 hover:text-white rounded-xl h-8 px-3"
                      >
                        <ChevronLeft size={14} className="mr-1" /> Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage * itemsPerPage >= totalLogs}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="bg-[#0F172A] border-slate-800 text-slate-400 hover:text-white rounded-xl h-8 px-3"
                      >
                        Próximo <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
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
        <DialogContent className="max-w-[1000px] w-[95vw] bg-[#020817] border border-amber-500/25 text-white p-0 overflow-hidden rounded-[24px] shadow-[0_25px_80px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <button 
            onClick={() => setIsLogDetailOpen(false)}
            className="absolute right-6 top-6 w-10 h-10 flex items-center justify-center rounded-full bg-amber-500/15 hover:bg-amber-500 text-white transition-all z-10"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          <DialogHeader className="p-8 pb-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 text-2xl">
                📨
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">Detalhes do Envio</DialogTitle>
                <p className="text-slate-400 text-sm">Informações completas da execução da automação.</p>
              </div>
            </div>
          </DialogHeader>
          
          {selectedLog && (
            <div className="p-8 pt-2 space-y-8 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
              {/* SEÇÃO SUPERIOR: CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">ID DA AUTOMAÇÃO</p>
                  <p className="text-xs font-mono text-amber-500/80 truncate" title={selectedLog.automation_id}>
                    {selectedLog.automation_id}
                  </p>
                </div>
                
                <div className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">STATUS</p>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${selectedLog.status === 'sent' ? 'text-[#10B981]' : 'text-rose-500'}`}>
                    {selectedLog.status === 'sent' ? <Check size={14} /> : <X size={14} />}
                    {selectedLog.status === 'sent' ? '✓ Enviado com sucesso' : 'Falha no envio'}
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">CANAL</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <MessageCircle size={14} className="text-amber-500" />
                    WhatsApp
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">DATA/HORA</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Clock size={14} className="text-slate-400" />
                    {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              {/* LINHA DO TEMPO DA AUTOMAÇÃO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Fluxo da Automação</h3>
                </div>
                
                <div className="bg-[#0F172A] border border-white/5 p-6 rounded-[24px]">
                  {/* Desktop Horizontal Timeline */}
                  <div className="hidden lg:flex items-start justify-between relative">
                    <div className="absolute top-4 left-0 right-0 h-[2px] bg-slate-800 -z-0" />
                    
                    {[
                      { label: "Evento Criado", status: "done", id: 1 },
                      { label: "Inserido na Fila", status: "done", id: 2 },
                      { label: "Processado", status: "done", id: 3 },
                      { label: "Mensagem Enviada", status: selectedLog.status === 'sent' ? "done" : "error", id: 4 },
                      { label: "Entregue", status: selectedLog.status === 'sent' ? "current" : "pending", id: 5 },
                      { label: "Lida", status: "pending", id: 6 },
                      { label: "Resposta", status: "pending", id: 7 },
                      { label: "Ação", status: "pending", id: 8 },
                      { label: "Finalizado", status: "pending", id: 9 }
                    ].map((step, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => {
                          if (step.id <= 5) {
                            setExpandedStep(step.id);
                            const element = document.getElementById('audit-section');
                            element?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className={`flex flex-col items-center gap-3 relative z-10 px-2 text-center max-w-[100px] transition-transform hover:scale-110 focus:outline-none ${step.id <= 5 ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#0F172A] shadow-lg ${
                          step.status === 'done' ? 'bg-[#10B981]' : 
                          step.status === 'current' ? 'bg-amber-500' : 
                          step.status === 'error' ? 'bg-rose-500' : 'bg-slate-700'
                        }`}>
                          {step.status === 'done' && <Check size={14} className="text-white" />}
                          {step.status === 'current' && <Clock size={14} className="text-slate-900" />}
                          {step.status === 'error' && <XCircle size={14} className="text-white" />}
                          {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-500" />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter leading-tight ${
                          step.status === 'done' ? 'text-[#10B981]' : 
                          step.status === 'current' ? 'text-amber-500' : 
                          step.status === 'error' ? 'text-rose-500' : 'text-slate-500'
                        }`}>
                          {step.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Mobile Vertical Timeline */}
                  <div className="lg:hidden space-y-4">
                    {[
                      { label: "Evento Criado", status: "done", time: "10:30:05", id: 1 },
                      { label: "Inserido na Fila", status: "done", time: "10:30:06", id: 2 },
                      { label: "Processado", status: "done", time: "10:30:07", id: 3 },
                      { label: "Mensagem Enviada", status: selectedLog.status === 'sent' ? "done" : "error", time: "10:30:08", id: 4 },
                      { label: "Entregue", status: selectedLog.status === 'sent' ? "current" : "pending", id: 5 },
                    ].map((step, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => {
                          setExpandedStep(step.id);
                          const element = document.getElementById('audit-section');
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center gap-4 w-full text-left transition-colors hover:bg-white/5 p-2 rounded-xl focus:outline-none"
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.status === 'done' ? 'bg-[#10B981]' : 
                          step.status === 'current' ? 'bg-amber-500' : 
                          step.status === 'error' ? 'bg-rose-500' : 'bg-slate-700'
                        }`}>
                          {step.status === 'done' && <Check size={12} className="text-white" />}
                          {step.status === 'current' && <Clock size={12} className="text-slate-900" />}
                          {step.status === 'error' && <XCircle size={12} className="text-white" />}
                          {step.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${step.status === 'done' ? 'text-[#10B981]' : step.status === 'current' ? 'text-amber-500' : 'text-slate-400'}`}>{step.label}</p>
                          {step.time && <p className="text-[10px] text-slate-500">{step.time}</p>}
                        </div>
                        <ChevronRight size={14} className="text-slate-600" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* AUDITORIA DO FLUXO TÉCNICA */}
              <div id="audit-section" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Auditoria do Fluxo</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={auditFilterType} onValueChange={(val) => { setAuditFilterType(val); setAuditPage(1); }}>
                      <SelectTrigger className="w-[140px] bg-[#0F172A] border-slate-800 text-xs h-8 rounded-lg text-white focus:ring-amber-500/50">
                        <Filter size={12} className="mr-2 text-slate-500" />
                        <SelectValue placeholder="Tipo de Evento" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Todos Eventos</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="queue">Fila</SelectItem>
                        <SelectItem value="send">Envio</SelectItem>
                        <SelectItem value="delivery">Entrega</SelectItem>
                        <SelectItem value="action">Ação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/5 text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Horário</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Evento</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Resultado</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {getAuditSteps(selectedLog)
                          .slice((auditPage - 1) * auditItemsPerPage, auditPage * auditItemsPerPage)
                          .map((step) => (
                          <React.Fragment key={step.id}>
                            <tr 
                              className={`transition-colors hover:bg-white/5 cursor-pointer ${expandedStep === step.id ? 'bg-amber-500/5' : ''}`}
                              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                            >
                              <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{step.time}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 border-none ${
                                    step.type === 'webhook' ? 'bg-blue-500/10 text-blue-400' :
                                    step.type === 'queue' ? 'bg-purple-500/10 text-purple-400' :
                                    step.type === 'send' ? 'bg-amber-500/10 text-amber-400' :
                                    step.type === 'delivery' ? 'bg-emerald-500/10 text-emerald-400' :
                                    'bg-slate-500/10 text-slate-400'
                                  }`}>
                                    {step.type}
                                  </Badge>
                                  <span className="font-mono text-white/90">{step.event}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={`flex items-center gap-1.5 font-bold ${step.status === 'done' ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                  {step.status === 'done' ? <Check size={14} /> : <X size={14} />}
                                  {step.result}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {expandedStep === step.id ? <ChevronUp size={16} className="ml-auto text-amber-500" /> : <ChevronDown size={16} className="ml-auto text-slate-600" />}
                              </td>
                            </tr>
                            {expandedStep === step.id && (
                              <tr className="bg-amber-500/[0.02]">
                                <td colSpan={4} className="px-6 py-4 border-l-2 border-amber-500/50">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-bold uppercase text-slate-500">Payload do Evento</p>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] text-amber-500 hover:bg-amber-500/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyText(JSON.stringify(step.payload, null, 2), "Payload");
                                        }}
                                      >
                                        <Copy size={12} className="mr-1.5" /> Copiar JSON
                                      </Button>
                                    </div>
                                    <div className="bg-[#081229] p-4 rounded-xl border border-white/5 font-mono text-[11px] text-sky-400 overflow-x-auto max-h-[200px] custom-scrollbar">
                                      <pre>{JSON.stringify(step.payload, null, 2)}</pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Audit Pagination */}
                  {getAuditSteps(selectedLog).length > auditItemsPerPage && (
                    <div className="px-6 py-4 bg-white/5 flex items-center justify-between border-t border-white/5">
                      <p className="text-[10px] text-slate-500">
                        Página {auditPage} de {Math.ceil(getAuditSteps(selectedLog).length / auditItemsPerPage)}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={auditPage === 1}
                          onClick={() => setAuditPage(prev => prev - 1)}
                          className="h-8 w-8 p-0 rounded-lg border border-white/5 text-slate-400"
                        >
                          <ChevronLeft size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={auditPage >= Math.ceil(getAuditSteps(selectedLog).length / auditItemsPerPage)}
                          onClick={() => setAuditPage(prev => prev + 1)}
                          className="h-8 w-8 p-0 rounded-lg border border-white/5 text-slate-400"
                        >
                          <ChevronRight size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* MENSAGEM PROCESSADA (WHATSAPP PREVIEW) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Mensagem Enviada</h3>
                  </div>
                  <div className="bg-[#0F172A] border border-white/10 rounded-[20px] overflow-hidden shadow-xl">
                    <div className="bg-slate-800/50 px-4 py-3 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-white font-bold text-xs">W</div>
                        <div>
                          <p className="text-xs font-bold text-white leading-none mb-1">WhatsApp</p>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span className="text-[10px] text-slate-400 font-medium">Online</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-[#10B981]/15 text-[#10B981] border-none text-[10px] uppercase font-bold px-2 py-0">Enviado</Badge>
                    </div>
                    
                    <div className="p-6 bg-[#0B141A] min-h-[300px] relative">
                      <div className="bg-[#054740] text-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] text-sm whitespace-pre-wrap leading-relaxed relative border border-white/5">
                        {selectedLog.processed_template || selectedLog.payload?.rendered}
                        <div className="text-[10px] text-white/50 text-right mt-2 flex items-center justify-end gap-1">
                          {new Date(selectedLog.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <CheckCheck size={14} className="text-sky-400" />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center text-xs font-bold text-sky-400">
                          Confirmar agendamento
                        </div>
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center text-xs font-bold text-sky-400">
                          Reagendar
                        </div>
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center text-xs font-bold text-sky-400">
                          Cancelar
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO TÉCNICA (TERMINAL) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileCode size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Dados Técnicos da Execução</h3>
                  </div>
                  <div className="bg-[#081229] border border-amber-500/15 rounded-[18px] p-6 font-mono text-xs overflow-hidden shadow-2xl relative group/terminal">
                    <div className="flex gap-1.5 absolute top-4 left-6">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    </div>

                    <div className="absolute top-4 right-6 opacity-0 group-hover/terminal:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 bg-white/5 text-amber-500 hover:bg-amber-500/10 border border-white/5"
                        onClick={() => handleCopyText(JSON.stringify({
                          zaap_id: selectedLog.response?.id,
                          provider_message_id: selectedLog.response?.id || selectedLog.id,
                          appointment_id: selectedLog.payload?.appointment_id,
                          customer_phone: selectedLog.phone,
                          workflow_key: "appointment_confirmation",
                          tenant_id: tenantId,
                          created_at: selectedLog.created_at,
                          payload: selectedLog.payload
                        }, null, 2), "JSON de Execução")}
                      >
                        <Code2 size={14} className="mr-2" /> Copiar Tudo (JSON)
                      </Button>
                    </div>
                    
                    <div className="mt-8 custom-scrollbar overflow-auto max-h-[400px]">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2 group/field">
                             <span className="text-sky-400">zaap_id:</span>
                             <div className="flex items-center justify-between gap-2 overflow-hidden">
                               <span className="text-[#10B981] break-all truncate">"{selectedLog.response?.id || 'null'}"</span>
                               <button onClick={() => handleCopyText(selectedLog.response?.id, "Zaap ID")} className="opacity-0 group-hover/field:opacity-100 p-1 hover:bg-white/10 rounded transition-all">
                                 <Copy size={12} className="text-slate-500" />
                               </button>
                             </div>
                           </div>
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2 group/field">
                             <span className="text-sky-400">provider_message_id:</span>
                             <div className="flex items-center justify-between gap-2 overflow-hidden">
                               <span className="text-[#10B981] break-all truncate">"{selectedLog.response?.id || selectedLog.id}"</span>
                               <button onClick={() => handleCopyText(selectedLog.response?.id || selectedLog.id, "Provider Message ID")} className="opacity-0 group-hover/field:opacity-100 p-1 hover:bg-white/10 rounded transition-all">
                                 <Copy size={12} className="text-slate-500" />
                               </button>
                             </div>
                           </div>
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2">
                             <span className="text-sky-400">appointment_id:</span>
                             <span className="text-[#10B981] break-all truncate">"{selectedLog.payload?.appointment_id || 'null'}"</span>
                           </div>
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2">
                             <span className="text-sky-400">customer_phone:</span>
                             <span className="text-[#10B981]">"{selectedLog.phone}"</span>
                           </div>
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2">
                             <span className="text-sky-400">workflow_key:</span>
                             <span className="text-[#10B981]">"appointment_confirmation"</span>
                           </div>
                           <div className="w-full grid grid-cols-[160px_1fr] gap-2 border-b border-white/5 pb-2 group/field">
                             <span className="text-sky-400">message_id:</span>
                             <div className="flex items-center justify-between gap-2 overflow-hidden">
                               <span className="text-[#10B981] break-all truncate">"{selectedLog.id}"</span>
                               <button onClick={() => handleCopyText(selectedLog.id, "Message ID")} className="opacity-0 group-hover/field:opacity-100 p-1 hover:bg-white/10 rounded transition-all">
                                 <Copy size={12} className="text-slate-500" />
                               </button>
                             </div>
                           </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-amber-500/20">
                          <p className="text-slate-500 mb-2">// Payload Bruto</p>
                          <pre className="text-amber-500/80 whitespace-pre-wrap">
                            {JSON.stringify(selectedLog.payload || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-rose-500">Erro Identificado</h3>
                  </div>
                  <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-2xl">
                    <p className="text-rose-400 font-mono text-sm leading-relaxed">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-8 pt-0 flex justify-end">
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-8 rounded-xl h-11 transition-all"
              onClick={() => setIsLogDetailOpen(false)}
            >
              Fechar Detalhes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPreviewOpen} onOpenChange={(open) => {
        setIsPreviewOpen(open);
        if (!open) {
          setIsPreviewEditMode(false);
          setPreviewSearchTerm("");
        }
      }}>
        <DialogContent className="max-w-2xl bg-[#0F172A] border-slate-800 text-white p-0 overflow-hidden rounded-[24px] focus:outline-none">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Eye className="text-amber-500" size={20} />
                Visualização da Mensagem
              </DialogTitle>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                  <Input 
                    placeholder="Buscar na mensagem..."
                    value={previewSearchTerm}
                    onChange={(e) => setPreviewSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-900 border-slate-700 w-[180px] rounded-lg focus:border-amber-500/50"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsPreviewEditMode(!isPreviewEditMode)}
                  className={`h-8 border-slate-700 rounded-lg text-xs ${isPreviewEditMode ? 'bg-amber-500 text-slate-900 border-amber-500 hover:bg-amber-600' : 'bg-slate-800 text-white'}`}
                >
                  <Settings2 size={12} className="mr-1.5" />
                  {isPreviewEditMode ? 'Ver Preview' : 'Editar Variáveis'}
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 pt-2 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 relative min-h-[300px]">
                <div className="absolute top-0 right-4 -translate-y-1/2 bg-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-900 uppercase">
                  WhatsApp Preview
                </div>
                
                <div className="mt-2 space-y-3 h-full flex flex-col">
                  <div className="bg-[#0F172A] border border-amber-500/25 text-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[95%] text-sm whitespace-pre-wrap leading-relaxed relative flex-grow">
                    <div className="mb-2">
                      {replaceVariables(selectedPreviewTemplate, true, previewSearchTerm)}
                    </div>
                    <div className="text-[10px] text-slate-400 text-right mt-1">
                      14:30 ✓✓
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <div className="bg-[#0F172A] hover:bg-white/5 transition-colors border border-amber-500/15 p-2.5 rounded-xl text-center text-sm font-semibold text-sky-400">
                      Confirmar agendamento
                    </div>
                  </div>
                </div>
              </div>

              {isPreviewEditMode && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Testar Variáveis</p>
                  <div className="space-y-3">
                    {Object.entries(customVariables).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[10px] text-slate-400">{key}</Label>
                        <Input 
                          value={value} 
                          onChange={(e) => setCustomVariables({...customVariables, [key]: e.target.value})}
                          className="h-8 text-xs bg-slate-900 border-slate-800 rounded-lg focus:border-amber-500/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white font-bold rounded-xl h-11"
                onClick={() => handleCopyTemplate(selectedPreviewTemplate)}
              >
                <Copy size={16} className="mr-2" /> Copiar Mensagem Completa
              </Button>
              
              <Button 
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl h-11"
                onClick={() => setIsPreviewOpen(false)}
              >
                Fechar Visualização
              </Button>
            </div>

            <p className="text-[10px] text-slate-500 text-center px-4 leading-tight">
              As cores indicam variáveis preenchidas dinamicamente. Edite os valores para simular diferentes cenários.
              Pressione ESC para fechar.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default AutomationsComponent;
