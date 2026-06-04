
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
  Info
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
  const [previewSearchResultIndex, setPreviewSearchResultIndex] = useState(0);
  const [previewTotalResults, setPreviewTotalResults] = useState(0);
  
  // Filtros Log Principal
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAutomation, setFilterAutomation] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logStats, setLogStats] = useState<any>({ sent: 0, success: 0, failed: 0, lastSent: null });
  const itemsPerPage = 10;

  // Estados Auditoria do Fluxo (Modal)
  const [auditFilterType, setAuditFilterType] = useState(() => {
    return localStorage.getItem(`auditFilterType_${tenantId}`) || "all";
  });
  const [auditSearchTerm, setAuditSearchTerm] = useState(() => {
    return localStorage.getItem(`auditSearchTerm_${tenantId}`) || "";
  });
  const [auditPage, setAuditPage] = useState(1);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const auditItemsPerPage = 5;
  const [statsLoading, setStatsLoading] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const [savedScenarios, setSavedScenarios] = useState<any[]>(() => {
    const saved = localStorage.getItem(`automation_scenarios_${tenantId}`);
    return saved ? JSON.parse(saved) : [];
  });



  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  async function fetchData() {
    if (!tenantId) return;
    setLoading(true);
    setStatsLoading(true);
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

      // 3. Fetch stats and failure reasons for each automation
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

        const { data: lastError } = await supabase
          .from("automation_logs")
          .select("created_at, error_message")
          .eq("automation_id", auto.id)
          .eq("status", "error")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...auto,
          stats: {
            sent: sentCount || 0,
            errors: errorCount || 0,
            lastSent: lastLog?.created_at || null,
            lastError: lastError || null
          }
        };
      }));

      setAutomations(enrichedAutomations);
      setStatsLoading(false);


      // 4. Fetch logs with filtering and pagination

      let query = supabase
        .from("automation_logs")
        .select("*", { count: 'exact' })
        .eq("tenant_id", tenantId);
        
      if (searchTerm) {
        // Search by phone, message_id (id), or provider_message_id (inside response)
        query = query.or(`phone.ilike.%${searchTerm}%,id.eq.${searchTerm},response->>messageId.ilike.%${searchTerm}%,response->>id.ilike.%${searchTerm}%`);
      }
        
      if (filterStatus !== "all") {
        const mappedStatus = filterStatus === "sent" ? "success" : filterStatus === "error" ? "error" : filterStatus;
        query = query.eq("status", mappedStatus);
      }
      
      if (filterAutomation !== "all") {
        query = query.eq("message_type", filterAutomation);
      }
      
      if (filterPeriod !== "all") {
        const now = new Date();
        let startDate = new Date();
        if (filterPeriod === "today") {
          // Use localized approach to ensure "today" matches the user's timezone start-of-day in UTC
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

      // Fetch global stats for logs
      const { count: totalSent } = await supabase.from("automation_logs").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId);
      const { count: totalSuccess } = await supabase.from("automation_logs").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "success");
      const { count: totalFailed } = await supabase.from("automation_logs").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "error");
      const { data: lastLog } = await supabase.from("automation_logs").select("created_at").eq("tenant_id", tenantId).eq("status", "success").order("created_at", { ascending: false }).limit(1).maybeSingle();

      setLogStats({
        sent: totalSent || 0,
        success: totalSuccess || 0,
        failed: totalFailed || 0,
        lastSent: lastLog?.created_at || null
      });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const INITIAL_VARIABLES = {
    customer_name: "João Silva",
    barbershop_name: "Barbex Premium",
    service_name: "Corte + Barba",
    professional_name: "Carlos (Mestre Barbeiro)",
    appointment_date: "15/06/2026",
    appointment_time: "14:30"
  };

  const [customVariables, setCustomVariables] = useState(INITIAL_VARIABLES);

  useEffect(() => {
    if (tenantId) {
      localStorage.setItem(`auditFilterType_${tenantId}`, auditFilterType);
    }
  }, [auditFilterType, tenantId]);

  useEffect(() => {
    if (tenantId) {
      localStorage.setItem(`auditSearchTerm_${tenantId}`, auditSearchTerm);
    }
  }, [auditSearchTerm, tenantId]);

  const saveScenario = () => {
    const scenarioName = prompt("Nome do cenário:");
    if (!scenarioName) return;
    const newScenarios = [...savedScenarios, { name: scenarioName, variables: { ...customVariables } }];
    setSavedScenarios(newScenarios);
    localStorage.setItem(`automation_scenarios_${tenantId}`, JSON.stringify(newScenarios));
    toast.success("Cenário salvo!");
  };

  const loadScenario = (scenario: any) => {
    setCustomVariables(scenario.variables);
    toast.success(`Cenário "${scenario.name}" aplicado!`);
  };

  const deleteScenario = (idx: number) => {
    const newScenarios = savedScenarios.filter((_, i) => i !== idx);
    setSavedScenarios(newScenarios);
    localStorage.setItem(`automation_scenarios_${tenantId}`, JSON.stringify(newScenarios));
    toast.success("Cenário removido.");
  };

  const countSearchResults = (text: string, term: string) => {
    if (!term) return 0;
    const regex = new RegExp(term, 'gi');
    return (text.match(regex) || []).length;
  };

  useEffect(() => {
    if (selectedPreviewTemplate && previewSearchTerm) {
      const rendered = replaceVariables(selectedPreviewTemplate, false, "") as string;
      const total = countSearchResults(rendered, previewSearchTerm);
      setPreviewTotalResults(total);
      setPreviewSearchResultIndex(total > 0 ? 1 : 0);
    } else {
      setPreviewTotalResults(0);
      setPreviewSearchResultIndex(0);
    }
  }, [previewSearchTerm, selectedPreviewTemplate]);

  const handlePreviewSearchKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        setPreviewSearchResultIndex(prev => prev > 1 ? prev - 1 : previewTotalResults);
      } else {
        setPreviewSearchResultIndex(prev => prev < previewTotalResults ? prev + 1 : 1);
      }
    }
  };

  const fetchAuditLogs = async (log: any) => {
    if (!log || !log.appointment_id) return;
    setIsAuditLoading(true);
    try {
      let query = supabase
        .from("automation_logs")
        .select("*", { count: 'exact' })
        .eq("appointment_id", log.appointment_id)
        .eq("tenant_id", tenantId || ""); // Filter by tenant_id for security and context

      if (auditSearchTerm) {
        query = query.or(`id.eq.${auditSearchTerm},payload->>diagnostic.ilike.%${auditSearchTerm}%,error_message.ilike.%${auditSearchTerm}%`);
      }

      if (auditFilterType !== "all" && auditFilterType !== "by_template") {
        if (auditFilterType === "webhook") {
          query = query.filter("payload->>diagnostic", "eq", "trigger_executed");
        } else if (auditFilterType === "queue") {
          query = query.filter("payload->>diagnostic", "eq", "queue_insert");
        } else if (auditFilterType === "send") {
          query = query.eq("status", "sent");
        } else if (auditFilterType === "delivery") {
          query = query.filter("payload->>diagnostic", "eq", "delivery_detected");
        } else if (auditFilterType === "by_template") {
          query = query.eq("automation_id", log.automation_id);
        }
      }

      const from = (auditPage - 1) * auditItemsPerPage;
      const to = from + auditItemsPerPage - 1;

      const { data, count, error } = await query
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) throw error;
      setAuditLogs(data || []);
      setTotalAuditLogs(count || 0);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsAuditLoading(false);
    }
  };

  useEffect(() => {
    if (isLogDetailOpen && selectedLog) {
      fetchAuditLogs(selectedLog);
    }
  }, [isLogDetailOpen, selectedLog, auditPage, auditFilterType, auditSearchTerm]);

  const handleExportAudit = (log: any, format: 'csv' | 'json') => {
    if (!auditLogs.length) return;
    
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `audit_${log.appointment_id}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else {
      const headers = ["ID", "Data", "Status", "Tipo", "Telefone", "Erro"];
      const rows = auditLogs.map(l => [
        l.id,
        new Date(l.created_at).toLocaleString('pt-BR'),
        l.status,
        l.message_type,
        l.phone,
        l.error_message || ""
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");
        
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `audit_${log.appointment_id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    toast.success(`Auditoria exportada em ${format.toUpperCase()}`);
  };


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
    const rendered = replaceVariables(template, false, "") as string;
    try {
      navigator.clipboard.writeText(rendered).then(() => {
        toast.success("Mensagem copiada para a área de transferência!");
      }).catch(() => {
        // Fallback para quando o clipboard API falha/bloqueia
        const textArea = document.createElement("textarea");
        textArea.value = rendered;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          toast.success("Mensagem copiada (via fallback)!");
        } catch (err) {
          toast.error("Não foi possível copiar automaticamente.");
        }
        document.body.removeChild(textArea);
      });
    } catch (e) {
      toast.error("Erro ao tentar copiar.");
    }
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

  const getLogIcon = (log: any) => {
    if (log.status === 'sent') return <CheckCircle2 className="text-emerald-500" size={16} />;
    if (log.status === 'error') return <XCircle className="text-rose-500" size={16} />;
    if (log.payload?.diagnostic === 'trigger_executed') return <Zap className="text-amber-500" size={16} />;
    if (log.status === 'pending') return <Clock className="text-sky-500" size={16} />;
    return <Info className="text-slate-500" size={16} />;
  };

  const getLogLabel = (log: any) => {
    if (log.payload?.diagnostic === 'trigger_executed') return "Gatilho Detectado";
    if (log.status === 'sent') return "Mensagem Enviada";
    if (log.status === 'error') return "Erro no Processamento";
    if (log.status === 'pending') return "Na Fila";
    return "Evento Desconhecido";
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

  const openLogDetail = async (log: any) => {
    setIsAuditLoading(true);
    setSelectedLog(log);
    setAuditPage(1);
    setIsLogDetailOpen(true);
    // Simulate loading for better UI experience
    setTimeout(() => setIsAuditLoading(false), 400);
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
                        {statsLoading ? (
                          <div className="h-4 w-8 bg-white/5 animate-pulse mx-auto rounded mt-1" />
                        ) : (
                          <p className="text-base font-bold text-white leading-none">{auto.stats?.sent || 0}</p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mb-0.5 flex items-center justify-center gap-1">
                          <AlertTriangle size={9} /> Falhas
                        </p>
                        {statsLoading ? (
                          <div className="h-4 w-8 bg-rose-500/5 animate-pulse mx-auto rounded mt-1" />
                        ) : (
                          <p className="text-base font-bold text-rose-400 leading-none">{auto.stats?.errors || 0}</p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter mb-0.5 flex items-center justify-center gap-1">
                          <Clock size={9} /> Último Envio
                        </p>
                        {statsLoading ? (
                          <div className="h-4 w-12 bg-white/5 animate-pulse mx-auto rounded mt-1" />
                        ) : (
                          <p className="text-[9px] font-medium text-slate-300 leading-tight">
                            {auto.stats?.lastSent 
                              ? new Date(auto.stats.lastSent).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + 
                                new Date(auto.stats.lastSent).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                              : 'Nunca'}
                          </p>
                        )}
                      </div>
                    </div>

                  </CardContent>

                  {auto.stats?.lastError && (
                    <div className="px-5 mb-3">
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2.5 flex items-start gap-2 animate-pulse">
                        <AlertTriangle size={14} className="text-rose-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Última Falha</p>
                          <p className="text-[10px] text-rose-300/80 italic line-clamp-1 mb-1">
                            {auto.stats.lastError.error_message || 'Erro desconhecido'}
                          </p>
                          <p className="text-[8px] text-slate-500">
                            {new Date(auto.stats.lastError.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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

          <TabsContent value="logs" className="pt-6 space-y-6">
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-[#0F172A] border-white/5 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <SendHorizontal size={40} className="text-white" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Enviados</CardDescription>
                  <CardTitle className="text-2xl font-bold text-white">{logStats.sent}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-[#0F172A] border-white/5 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CheckCircle2 size={40} className="text-[#10B981]" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sucessos</CardDescription>
                  <CardTitle className="text-2xl font-bold text-[#10B981]">{logStats.success}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-[#0F172A] border-white/5 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <XCircle size={40} className="text-[#EF4444]" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Falhas</CardDescription>
                  <CardTitle className="text-2xl font-bold text-[#EF4444]">{logStats.failed}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-[#0F172A] border-white/5 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Clock size={40} className="text-amber-500" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Último Envio</CardDescription>
                  <CardTitle className="text-sm font-bold text-white mt-2">
                    {logStats.lastSent ? new Date(logStats.lastSent).toLocaleString('pt-BR') : 'Sem registros'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="bg-[#020817] border-white/5 shadow-2xl rounded-[24px] overflow-hidden">
              <CardHeader className="pb-6 border-b border-white/5 bg-[#0F172A]/50">
                <div className="flex flex-col gap-6">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2 text-white">
                      <History size={24} className="text-amber-500" /> Histórico de Envios
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-1">
                      Acompanhe as mensagens automáticas enviadas pelo sistema.
                    </CardDescription>
                  </div>
                  
                  {/* Barra de Filtros Única */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#020817] p-4 rounded-2xl border border-white/5 shadow-inner">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={14} />
                      <Input 
                        placeholder="Buscar destinatário..." 
                        className="pl-9 w-full bg-[#0F172A] border-slate-800 text-sm h-11 rounded-xl text-white focus:border-amber-500/50 focus:ring-amber-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>

                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={14} />
                      <Input 
                        placeholder="Buscar ID Agendamento..." 
                        className="pl-9 w-full bg-[#0F172A] border-slate-800 text-sm h-11 rounded-xl text-white focus:border-amber-500/50 focus:ring-amber-500/20 transition-all"
                        value={searchTerm.startsWith('appointment:') ? searchTerm.replace('appointment:', '') : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchTerm(val ? `appointment:${val}` : '');
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                    
                    <Select value={filterAutomation} onValueChange={setFilterAutomation}>
                      <SelectTrigger className="w-full bg-[#0F172A] border-slate-800 text-sm h-11 rounded-xl text-white focus:ring-amber-500/20">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-slate-500" />
                          <SelectValue placeholder="Automação" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Todas Automações</SelectItem>
                        <SelectItem value="appointment_confirmation">Confirmação</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                      <SelectTrigger className="w-full bg-[#0F172A] border-slate-800 text-sm h-11 rounded-xl text-white focus:ring-amber-500/20">
                        <div className="flex items-center gap-2">
                          <CalendarIcon size={14} className="text-slate-500" />
                          <SelectValue placeholder="Período" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Sempre</SelectItem>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="7days">Últimos 7 Dias</SelectItem>
                        <SelectItem value="30days">Últimos 30 Dias</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full bg-[#0F172A] border-slate-800 text-sm h-11 rounded-xl text-white focus:ring-amber-500/20">
                        <div className="flex items-center gap-2">
                          <Filter size={14} className="text-slate-500" />
                          <SelectValue placeholder="Status" />
                        </div>
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
              <CardContent className="p-0">
                    {/* Desktop view for logs (Table) */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full border-collapse">
                    <thead className="bg-[#0F172A]/80 sticky top-0 z-10">
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">Data/Hora</th>
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">Automação</th>
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">Canal</th>
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">Destinatário</th>
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">ID Agendamento</th>
                        <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest text-slate-500">Status</th>
                        <th className="px-6 py-4 text-right font-bold text-[10px] uppercase tracking-widest text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.map((log, idx) => (
                        <tr key={log.id} className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'} hover:bg-white/[0.05] transition-colors group`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white">{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-white/10 ${
                              log.message_type === 'buttons' ? 'text-sky-400 bg-sky-500/5' : 
                              log.message_type === 'text_fallback' ? 'text-amber-400 bg-amber-500/5' : 
                              'text-slate-300 bg-white/5'
                            }`}>
                              {log.message_type === 'buttons' ? 'Botões' : 
                               log.message_type === 'text_fallback' ? 'Texto' : 
                               'Confirmação'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {log.provider === 'zapi' ? (
                                <>
                                  <Smartphone size={14} className="text-[#10B981]" />
                                  <span className="text-xs font-medium text-slate-400">WhatsApp</span>
                                </>
                              ) : log.provider === 'email' ? (
                                <>
                                  <MessageSquare size={14} className="text-sky-500" />
                                  <span className="text-xs font-medium text-slate-400">E-mail</span>
                                </>
                              ) : (
                                <>
                                  <Terminal size={14} className="text-slate-500" />
                                  <span className="text-xs font-medium text-slate-400">Sistema</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-white">{log.payload?.data?.customer_name || 'Cliente'}</span>
                              <span className="text-xs text-slate-500 font-mono">{log.phone}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="font-mono text-[10px] border-white/10 text-slate-400 bg-white/5">
                              #{log.appointment_id?.substring(0, 8).toUpperCase() || '---'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {log.status === 'success' || log.status === 'sent' ? (
                              <Badge className="bg-[#10B981]/10 text-[#10B981] border-none text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                                <Check size={12} strokeWidth={3} /> Enviado
                              </Badge>
                            ) : log.status === 'failed' || log.status === 'error' ? (
                              <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-none text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                                <X size={12} strokeWidth={3} /> Falhou
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-500 border-none text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                                <Clock size={12} /> {log.status === 'processing' ? 'Processando' : 'Pendente'}
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-amber-500 hover:text-slate-900 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-500 transition-all"
                                onClick={() => openLogDetail(log)}
                                title="Ver Detalhes"
                              >
                                <Terminal size={12} className="mr-1.5" /> Detalhes
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-sky-500 hover:text-white rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 transition-all"
                                onClick={async () => {
                                  toast.loading("Reenviando...");
                                  try {
                                    const { data, error } = await supabase.functions.invoke('process-automation-queue', {
                                      body: { 
                                        tenant_id: tenantId, 
                                        appointment_id: log.appointment_id,
                                        force_resend: true 
                                      }
                                    });
                                    
                                    if (error) throw error;
                                    toast.success("Solicitação de reenvio processada!");
                                    fetchData();
                                  } catch (err: any) {
                                    toast.error("Erro ao reenviar: " + err.message);
                                  }
                                }}
                                title="Reprocessar"
                              >
                                <RotateCcw size={12} className="mr-1.5" /> Reenviar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                {totalLogs > itemsPerPage && (
                  <div className="flex items-center justify-between p-6 border-t border-white/5 bg-[#0F172A]/50">
                    <p className="text-xs text-slate-500">
                      Mostrando <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, totalLogs)}</span> de <span className="text-white font-medium">{totalLogs}</span> registros
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => {
                           setCurrentPage(prev => Math.max(1, prev - 1));
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="bg-[#0F172A] border-slate-800 text-slate-400 hover:text-white rounded-xl h-9 px-4"
                      >
                        <ChevronLeft size={16} className="mr-1" /> Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage * itemsPerPage >= totalLogs}
                        onClick={() => {
                           setCurrentPage(prev => prev + 1);
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="bg-[#0F172A] border-slate-800 text-slate-400 hover:text-white rounded-xl h-9 px-4"
                      >
                        Próximo <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile view for logs (Cards) */}
      <div className="lg:hidden space-y-4 px-4 pb-8">
        {logs.map((log) => (
          <div key={log.id} className="bg-[#0F172A] border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
                <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
              </div>
              {log.status === 'sent' ? (
                <Badge className="bg-[#10B981]/10 text-[#10B981] border-none text-[10px] font-bold px-2 py-1 rounded-lg">
                  Enviado
                </Badge>
              ) : log.status === 'error' ? (
                <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-none text-[10px] font-bold px-2 py-1 rounded-lg">
                  Falhou
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[10px] font-bold px-2 py-1 rounded-lg">
                  Pendente
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Destinatário:</span>
                <span className="text-white font-medium">{log.payload?.data?.customer_name || 'Cliente'} ({log.phone})</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Automação:</span>
                <span className="text-white font-medium">{log.message_type === 'appointment_confirmation' ? 'Confirmação' : 'Outra'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Canal:</span>
                <span className="text-white font-medium">{log.provider === 'zapi' ? 'WhatsApp' : 'Sistema'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Agendamento:</span>
                <span className="text-slate-400 font-mono text-[10px]">#{log.appointment_id?.substring(0, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-white/5 border-white/10 text-xs rounded-xl h-10"
                onClick={() => openLogDetail(log)}
              >
                <Terminal size={12} className="mr-2" /> Detalhes
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-white/5 border-white/10 text-xs rounded-xl h-10"
                onClick={() => resendTest(log)}
              >
                <RotateCcw size={12} className="mr-2" /> Reenviar
              </Button>
            </div>
          </div>
        ))}
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

          <DialogHeader className="p-8 pb-4 bg-[#0F172A]/50 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 text-3xl">
                📨
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">Detalhes do Envio</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400 text-sm">Informações completas do processamento</span>
                  <div className="w-1 h-1 rounded-full bg-slate-600" />
                  <span className="text-slate-500 text-xs font-mono uppercase">ID: {selectedLog?.id?.substring(0,8)}</span>
                </div>
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
                
                <div className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl relative">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">STATUS DO PROFISSIONAL</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {selectedLog.payload?.diagnostic?.professional_resolved ? (
                      <>
                        <CheckCircle2 size={14} className="text-[#10B981]" />
                        <span className="text-[#10B981]">OK: {selectedLog.payload?.data?.professional_name}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                        <span className="text-amber-500" title="Relacionamento ausente ou nome genérico">AVISO: Ausente</span>
                      </>
                    )}
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

              {/* PAYLOAD E DADOS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Payload da Mensagem</h3>
                  </div>
                  <div className="bg-[#0F172A] border border-white/5 p-6 rounded-[24px] h-[300px] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">JSON Bruto</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[10px] text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedLog.payload, null, 2));
                          toast.success("Copiado!");
                        }}
                      >
                        <Copy size={10} className="mr-1" /> Copiar
                      </Button>
                    </div>
                    <pre className="text-[10px] font-mono text-amber-500/80 overflow-y-auto custom-scrollbar flex-1 bg-black/20 p-4 rounded-xl">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Mensagem Processada</h3>
                  </div>
                  <div className="bg-[#0F172A] border border-white/5 p-6 rounded-[24px] h-[300px] overflow-y-auto custom-scrollbar">
                    <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedLog.processed_template || "Mensagem não disponível"}
                    </div>
                  </div>
                </div>
              </div>

              {/* LINHA DO TEMPO DA AUTOMAÇÃO */}
              <div className="space-y-4 pt-4">
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

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                      <Input 
                        placeholder="Buscar ID ou evento..." 
                        className="pl-8 w-[180px] bg-[#0F172A] border-slate-800 text-xs h-8 rounded-lg text-white focus:border-amber-500/50"
                        value={auditSearchTerm}
                        onChange={(e) => {
                          setAuditSearchTerm(e.target.value);
                          setAuditPage(1);
                        }}
                      />
                    </div>

                    <Select value={auditFilterType} onValueChange={(val) => { setAuditFilterType(val); setAuditPage(1); }}>
                      <SelectTrigger className="w-[130px] bg-[#0F172A] border-slate-800 text-xs h-8 rounded-lg text-white focus:ring-amber-500/50">
                        <Filter size={12} className="mr-2 text-slate-500" />
                        <SelectValue placeholder="Evento" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="by_template">Este Template</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="queue">Fila</SelectItem>
                        <SelectItem value="send">Envio</SelectItem>
                        <SelectItem value="delivery">Entrega</SelectItem>
                        <SelectItem value="action">Ação</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] text-slate-400 hover:text-white"
                        onClick={() => handleExportAudit(selectedLog, 'csv')}
                      >
                        <FileCode size={12} className="mr-1.5" /> CSV
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] text-slate-400 hover:text-white"
                        onClick={() => handleExportAudit(selectedLog, 'json')}
                      >
                        <Code2 size={12} className="mr-1.5" /> JSON
                      </Button>
                    </div>
                  </div>

                </div>

                <div className="bg-[#0F172A] border border-white/5 rounded-2xl overflow-hidden shadow-lg min-h-[300px] relative">
                  {isAuditLoading && (
                    <div className="absolute inset-0 bg-[#0F172A]/80 backdrop-blur-sm z-50 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-amber-500" size={32} />
                        <p className="text-sm font-bold text-amber-500 uppercase tracking-widest animate-pulse">Carregando Auditoria...</p>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/5 text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Horário</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Evento / IDs</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider">Resultado</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                              Nenhum evento encontrado para esta auditoria.
                            </td>
                          </tr>
                        ) : auditLogs.map((step) => (
                          <React.Fragment key={step.id}>
                            <tr 
                              className={`transition-colors hover:bg-white/5 cursor-pointer ${expandedStep === step.id ? 'bg-amber-500/5' : ''}`}
                              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                            >
                              <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                {new Date(step.created_at).toLocaleTimeString('pt-BR')}
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    {getLogIcon(step)}
                                    <span className="font-mono text-white/90">{getLogLabel(step)}</span>
                                  </div>
                                  
                                  {/* IDs Quick Copy */}
                                  <div className="flex gap-2">
                                    {(step.response?.messageId || step.response?.id) && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleCopyText(step.response.messageId || step.response.id, "ID Provedor"); }}
                                        className="text-[9px] bg-white/5 hover:bg-white/10 text-slate-500 hover:text-amber-500 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                                      >
                                        <Copy size={8} /> Prov: {(step.response.messageId || step.response.id).substring(0, 10)}...
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleCopyText(step.id, "ID Mensagem"); }}
                                      className="text-[9px] bg-white/5 hover:bg-white/10 text-slate-500 hover:text-amber-500 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                                    >
                                      <Copy size={8} /> Msg: {step.id.substring(0, 8)}...
                                    </button>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className={`flex items-center gap-1.5 font-bold ${step.status === 'sent' ? 'text-[#10B981]' : step.status === 'error' ? 'text-rose-500' : 'text-amber-500'}`}>
                                  {step.status === 'sent' ? <Check size={14} /> : step.status === 'error' ? <X size={14} /> : <Clock size={14} />}
                                  {step.status === 'sent' ? 'Sucesso' : step.status === 'error' ? 'Falha' : 'Pendente'}
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
                                      <pre>{JSON.stringify(step.payload || {}, null, 2)}</pre>
                                    </div>
                                    {step.error_message && (
                                      <div className="mt-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                        <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Motivo do Erro</p>
                                        <p className="text-xs text-rose-400 font-mono">{step.error_message}</p>
                                      </div>
                                    )}
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
                  {totalAuditLogs > auditItemsPerPage && (
                    <div className="px-6 py-4 bg-white/5 flex items-center justify-between border-t border-white/5">
                      <p className="text-[10px] text-slate-500">
                        Página {auditPage} de {Math.ceil(totalAuditLogs / auditItemsPerPage)}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={auditPage === 1}
                          onClick={() => setAuditPage(prev => Math.max(1, prev - 1))}
                          className="h-8 w-8 p-0 rounded-lg border border-white/5 text-slate-400"
                        >
                          <ChevronLeft size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={auditPage >= Math.ceil(totalAuditLogs / auditItemsPerPage)}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Eye className="text-amber-500" size={20} />
                Visualização da Mensagem
              </DialogTitle>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                    <Input 
                      placeholder="Buscar na mensagem..."
                      value={previewSearchTerm}
                      onChange={(e) => setPreviewSearchTerm(e.target.value)}
                      onKeyDown={handlePreviewSearchKeydown}
                      className="h-8 pl-8 text-xs bg-slate-900 border-slate-700 w-[160px] rounded-lg focus:border-amber-500/50"
                    />
                  </div>
                  {previewTotalResults > 0 && (
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 h-8 border border-slate-700">
                      <span className="text-[10px] text-slate-400">{previewSearchResultIndex}/{previewTotalResults}</span>
                      <div className="flex flex-col">
                        <button onClick={() => setPreviewSearchResultIndex(prev => prev > 1 ? prev - 1 : previewTotalResults)} className="hover:text-amber-500 h-3 flex items-center">
                          <ChevronUp size={10} />
                        </button>
                        <button onClick={() => setPreviewSearchResultIndex(prev => prev < previewTotalResults ? prev + 1 : 1)} className="hover:text-amber-500 h-3 flex items-center">
                          <ChevronDown size={10} />
                        </button>
                      </div>
                    </div>
                  )}
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
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Testar Variáveis</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[9px] hover:text-amber-500" 
                      onClick={() => setCustomVariables(INITIAL_VARIABLES)}
                    >
                      <RotateCcw size={10} className="mr-1" /> Resetar
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(customVariables).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[10px] text-slate-400">{key}</Label>
                        <Input 
                          value={value as string} 
                          onChange={(e) => setCustomVariables({...customVariables, [key]: e.target.value})}
                          className="h-8 text-xs bg-slate-900 border-slate-800 rounded-lg focus:border-amber-500/50"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 space-y-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cenários Salvos</p>
                      <Button variant="ghost" size="sm" className="h-6 text-[9px] hover:text-amber-500" onClick={saveScenario}>
                        <Check size={10} className="mr-1" /> Salvar Atual
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {savedScenarios.length === 0 ? (
                        <p className="text-[9px] text-slate-600 italic">Nenhum cenário salvo.</p>
                      ) : (
                        savedScenarios.map((scenario, idx) => (
                          <div key={idx} className="flex items-center gap-2 group">
                            <button 
                              onClick={() => loadScenario(scenario)}
                              className="flex-1 text-left bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] truncate transition-colors"
                            >
                              {scenario.name}
                            </button>
                            <button onClick={() => deleteScenario(idx)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all">
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
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
