import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Mail, 
  Settings2, 
  History, 
  Play, 
  CalendarCheck, 
  BellRing, 
  Clock, 
  Ban, 
  Gift, 
  UserMinus, 
  Star,
  AlertCircle,
  Zap,
  Lock,
  ArrowRight,
  Sparkles,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

const AUTOMATION_TYPES = [
  { id: "appointment_confirmation", title: "Confirmação de Agendamento", description: "Enviado assim que o cliente realiza um novo agendamento.", icon: CalendarCheck, color: "text-blue-500", bg: "bg-blue-50", trigger: "Novo Agendamento", plan: "starter" },
  { id: "appointment_reminder", title: "Lembrete de Agendamento", description: "Lembre o cliente do seu horário.", icon: BellRing, color: "text-amber-500", bg: "bg-amber-50", trigger: "Horário Próximo", plan: "starter" },
  { id: "rescheduling", title: "Reagendamento", description: "Notifica sobre mudanças de horário ou profissional.", icon: Clock, color: "text-purple-500", bg: "bg-purple-50", trigger: "Alteração de Horário", plan: "pro" },
  { id: "cancellation", title: "Cancelamento", description: "Enviado quando um agendamento é cancelado.", icon: Ban, color: "text-red-500", bg: "bg-red-50", trigger: "Agendamento Cancelado", plan: "pro" },
  { id: "birthday", title: "Mensagem de Aniversário", description: "Parabenize seus clientes no dia especial.", icon: Gift, color: "text-pink-500", bg: "bg-pink-50", trigger: "Data de Nascimento", plan: "pro" },
  { id: "inactive_customer", title: "Cliente Inativo", description: "Recupere clientes inativos há 30 dias.", icon: UserMinus, color: "text-orange-500", bg: "bg-orange-50", trigger: "Inatividade", plan: "pro" },
  { id: "post_service", title: "Pós-Atendimento", description: "Solicite avaliações após o serviço.", icon: Star, color: "text-green-500", bg: "bg-green-50", trigger: "Serviço Concluído", plan: "pro" },
  { id: "professional_confirmation", title: "Confirmação p/ Profissional", description: "Notifique o barbeiro sobre novos atendimentos.", icon: CalendarCheck, color: "text-cyan-500", bg: "bg-cyan-50", trigger: "Agendamento Confirmado", plan: "pro" },
  { id: "service_rating", title: "Avaliação de Atendimento", description: "Solicite feedback detalhado.", icon: Star, color: "text-yellow-500", bg: "bg-yellow-50", trigger: "Após serviço", plan: "elite" },
  { id: "manual_promotion", title: "Promoções Manuais", description: "Envie ofertas exclusivas.", icon: Zap, color: "text-indigo-500", bg: "bg-indigo-50", trigger: "Manual", plan: "elite" },
  { id: "cancellation_recovery", title: "Recuperação de Cancelamento", description: "Tente recuperar clientes que cancelaram.", icon: RefreshCw, color: "text-rose-500", bg: "bg-rose-50", trigger: "Cancelamento", plan: "elite" },
  { id: "day_reminder", title: "Lembrete do Dia", description: "Aviso matinal com agenda do dia.", icon: BellRing, color: "text-teal-500", bg: "bg-teal-50", trigger: "Início do dia", plan: "elite" }
];

function AutomationsComponent() {
  const { user, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { plan } = usePlanLimits();
  const navigate = useNavigate();
  
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cronStatus, setCronStatus] = useState<any>(null);
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [nextRunIn, setNextRunIn] = useState<string>("");
  const [serverInfo, setServerInfo] = useState<{ server_time: string; timezone: string; br_time: string; fetch_time: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isIAExecuting, setIsIAExecuting] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isForcingAll, setIsForcingAll] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<any>(null);
  const [isSummaryDialogOpen] = useState(false);
  const [isManualSummaryOpen, setIsManualSummaryOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [activeConversations, setActiveConversations] = useState<any[]>([]);
  const [isTestWebhookLoading, setIsTestWebhookLoading] = useState(false);


  const fetchServerInfo = async () => {
    const { data } = await supabase.rpc('get_server_info');
    if (data) {
      setServerInfo({ ...(data as any), fetch_time: Date.now() });
    }
  };


  const calculateNextRun = () => {
    let now: Date;
    if (serverInfo) {
      const elapsed = Date.now() - serverInfo.fetch_time;
      now = new Date(new Date(serverInfo.server_time).getTime() + elapsed);
    } else {
      now = new Date();
    }
    
    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil((minutes + 0.01) / 5) * 5;
    const nextRun = new Date(now);
    nextRun.setMinutes(nextMinutes, 0, 0);
    
    if (nextMinutes >= 60) {
      nextRun.setHours(now.getHours() + 1);
      nextRun.setMinutes(0, 0, 0);
    }
    
    const diff = nextRun.getTime() - now.getTime();
    if (diff < 0) {
      setNextRunIn("00:00");
      return;
    }
    
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    setNextRunIn(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
  };

  useEffect(() => {
    fetchServerInfo();
    const serverSyncTimer = setInterval(fetchServerInfo, 60000);
    const timer = setInterval(calculateNextRun, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(serverSyncTimer);
    };
  }, [serverInfo?.server_time, serverInfo?.fetch_time]);


  const handleTestAutomation = async (automation: any) => {
    if (!tenantId) return;
    setIsTesting(automation.id || automation.type);
    
    try {
      const template = automation.template || getDefaultTemplate(automation.type);
      
      const { data: result, error } = await supabase.functions.invoke('test-automation', {
        body: {
          automationId: automation.id,
          automationType: automation.type,
          template: template
        }
      });

      if (error) throw error;
      
      if (result.success) {
        toast.success("Mensagem de teste enviada com sucesso!");
        console.log("Mensagem processada:", result.processedMessage);
        fetchLogs();
      } else {
        toast.error("Erro ao enviar teste: " + (result.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      console.error("Test Error:", err);
      toast.error(err.message || "Erro ao processar teste de envio");
    } finally {
      setIsTesting(null);
    }
  };

  const handleRunAllAutomations = async (forceMode = false) => {
    if (!tenantId) return;
    if (forceMode) setIsForcingAll(true);
    else setIsRunningAll(true);
    
    setExecutionSummary(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('run-automations', {
        body: { tenantId, forceMode }
      });

      if (error) throw error;
      
      if (data.success) {
        setExecutionSummary(data);
        
        const sent = data.messagesSent?.filter((m: any) => m.status === 'success').length || 0;
        const found = (data.appointmentsFound?.length || 0) + (data.birthdaysFound?.length || 0);
        const failed = data.messagesSent?.filter((m: any) => m.status === 'error').length || 0;

        if (found === 0 && (!data.ignoredRecords || data.ignoredRecords.length === 0)) {
          toast.info("Nenhuma automação precisava ser processada no momento.");
        } else if (sent > 0) {
          toast.success(`${sent} mensagens enviadas com sucesso!`);
        } else if (failed > 0) {
          toast.error(`${failed} mensagens falharam ao enviar.`);
        }

        setIsManualSummaryOpen(true);
        fetchLogs();
        fetchCronStatus();
      } else {
        toast.error("Erro ao executar automações: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      console.error("Run All Error:", err);
      toast.error(err.message || "Erro ao processar execução das automações");
    } finally {
      setIsRunningAll(false);
      setIsForcingAll(false);
    }
  };



  useEffect(() => {
    if (tenantId) {
      fetchAutomations();
      fetchLogs();
      fetchCronStatus();
      fetchDebugData();
      
      // Real-time updates for automation status
      const statusChannel = supabase
        .channel('automation_status_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'automation_status' 
        }, () => {
          fetchCronStatus();
        })
        .subscribe();

      // Real-time updates for logs
      const logsChannel = supabase
        .channel('automation_logs_changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_logs',
          filter: `tenant_id=eq.${tenantId}`
        }, () => {
          fetchLogs();
          fetchCronStatus();
        })
        .subscribe();
        
      const debugChannel = supabase
        .channel('debug_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'zapi_webhook_debug' }, () => fetchDebugData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_conversations' }, () => fetchDebugData())
        .subscribe();
        
      return () => {
        supabase.removeChannel(statusChannel);
        supabase.removeChannel(logsChannel);
        supabase.removeChannel(debugChannel);
      };
    }
  }, [tenantId]);

  async function fetchAutomations() {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("tenant_id", tenantId);
    
    if (data) setAutomations(data);
    setLoading(false);
  }

  async function fetchLogs() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("automation_logs")
      .select("*, automations(type), customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) setLogs(data);
  }

  async function fetchCronStatus() {
    if (!tenantId) return;
    try {
      const { data: cronData } = await supabase.rpc('get_cron_status');
      if (cronData && cronData.length > 0) {
        setCronStatus(cronData[0]);
      }
      
      // Calculate real stats for this tenant from the DB
      const [{ count: activeCount }, { data: logStats }] = await Promise.all([
        supabase.from("automations").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("enabled", true),
        supabase.from("automation_logs").select("status").eq("tenant_id", tenantId)
      ]);

      const sent = logStats?.filter(l => l.status === 'success').length || 0;
      const failed = logStats?.filter(l => l.status === 'error').length || 0;

      // Also get the latest global status for the scheduler info
      const { data: statusData } = await supabase
        .from("automation_status")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (statusData) {
        setAutomationStatus({
          ...statusData,
          total_processed: activeCount || 0,
          messages_sent: sent,
          messages_failed: failed
        });
      }
    } catch (err) {
      console.error("Error fetching status:", err);
    }
  }

  async function fetchDebugData() {
    if (!tenantId) return;
    
    const { data: dLogs } = await supabase
      .from("zapi_webhook_debug")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("received_at", { ascending: false })
      .limit(10);
      
    if (dLogs) setDebugLogs(dLogs);

    const { data: convs } = await supabase
      .from("automation_conversations")
      .select("*, customers(name)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10);
      
    if (convs) setActiveConversations(convs);
  }

  const handleTestWebhookManually = async (phone: string, text: string = "1") => {
    if (!tenantId) return;
    setIsTestWebhookLoading(true);
    
    try {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_id")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .maybeSingle();

      if (!instance) {
        toast.error("Nenhuma instância Z-API conectada encontrada para teste.");
        return;
      }

      const payload = {
        type: "ReceivedMessage",
        instanceId: instance.instance_id,
        phone: phone,
        text: { message: text },
        message: { text: text },
        source: "manual_simulation"
      };

      const { data, error } = await supabase.functions.invoke('zapi-webhook', {
        body: payload
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("Simulação de webhook enviada com sucesso!");
        fetchDebugData();
        fetchLogs();
      } else {
        toast.error("Erro na simulação: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      console.error("Test Webhook Error:", err);
      toast.error(err.message || "Erro ao processar simulação de webhook");
    } finally {
      setIsTestWebhookLoading(false);
    }
  };


  async function handleToggleAutomation(type: string, currentEnabled: boolean) {
    if (!tenantId) return;
    
    const existing = automations.find(a => a.type === type);
    
    if (existing) {
      const { error } = await supabase
        .from("automations")
        .update({ enabled: !currentEnabled })
        .eq("id", existing.id);
      
      if (!error) {
        toast.success(`Automação ${!currentEnabled ? 'ativada' : 'desativada'}!`);
        fetchAutomations();
      }
    } else {
      const { error } = await supabase
        .from("automations")
        .insert({
          tenant_id: tenantId,
          type,
          enabled: true,
          trigger_type: 'event'
        });
      
      if (!error) {
        toast.success("Automação ativada!");
        fetchAutomations();
      }
    }
  }

  const openEditModal = (type: string) => {
    const existing = automations.find(a => a.type === type);
    const config = AUTOMATION_TYPES.find(a => a.id === type);
    
    setSelectedAutomation({
      type,
      title: config?.title,
      id: existing?.id,
      enabled: existing?.enabled || false,
      channel: existing?.channel || 'whatsapp',
      template: existing?.template || getDefaultTemplate(type),
      trigger_delay: existing?.trigger_delay || 0
    });
    setIsEditModalOpen(true);
  };

  const saveAutomation = async () => {
    if (!tenantId || !selectedAutomation) return;
    
    const data = {
      tenant_id: tenantId,
      type: selectedAutomation.type,
      enabled: selectedAutomation.enabled,
      channel: selectedAutomation.channel,
      template: selectedAutomation.template,
      trigger_delay: selectedAutomation.trigger_delay,
      trigger_type: 'event'
    };

    let error;
    if (selectedAutomation.id) {
      const { error: err } = await supabase
        .from("automations")
        .update(data)
        .eq("id", selectedAutomation.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("automations")
        .insert(data);
      error = err;
    }

    if (error) {
      toast.error("Erro ao salvar automação");
    } else {
      toast.success("Automação salva com sucesso!");
      setIsEditModalOpen(false);
      fetchAutomations();
    }
  };

  const generateWithIA = async () => {
    setIsIAExecuting(true);
    // Simulate IA generation
    setTimeout(() => {
      setSelectedAutomation({
        ...selectedAutomation,
        template: `Olá {{cliente_nome}}! 🌟\n\nNotamos que você não nos visita há algum tempo. Sentimos sua falta aqui na {{barbearia_nome}}! 💈\n\nPara que você volte a ficar com o visual impecável, preparamos um presente especial: use o cupom VOLTOU10 e ganhe 10% de desconto no seu próximo corte. ✂️\n\nAgende agora pelo link: {{link_agendamento}}\n\nEsperamos por você!`
      });
      setIsIAExecuting(false);
      toast.success("Template gerado pela IA com sucesso!");
    }, 1500);
  };

  const getDefaultTemplate = (type: string) => {
    switch(type) {
      case 'appointment_confirmation':
        return "Olá {{cliente_nome}}, seu agendamento na {{barbearia_nome}} foi confirmado!\n\n📅 Data: {{data}}\n⏰ Horário: {{horario}}\n💈 Profissional: {{profissional}}\n✂️ Serviço: {{servico}}";
      case 'appointment_reminder':
        return "Olá {{cliente_nome}}, passando para lembrar do seu horário hoje na {{barbearia_nome}} às {{horario}}.";
      case 'birthday':
        return "Parabéns {{cliente_nome}}! 🎉 A {{barbearia_nome}} te deseja um feliz aniversário! Venha comemorar conosco e ganhe um desconto especial.";
      default:
        return "Olá {{cliente_nome}}...";
    }
  };

  const isFeatureLocked = (automationPlan: string) => {
    if (plan === 'elite') return false;
    if (plan === 'pro' && automationPlan === 'elite') return true;
    if (plan === 'starter' && (automationPlan === 'pro' || automationPlan === 'elite')) return true;
    if (plan === 'free' && automationPlan !== 'free') return true;
    return false;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Automações Inteligentes</h2>
            <p className="text-muted-foreground">Configure notificações e lembretes automáticos para seus clientes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50" 
              onClick={() => handleRunAllAutomations(true)}
              disabled={isForcingAll}
            >
              {isForcingAll ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
              Processar todos os agendamentos agora
            </Button>
            <Button 
              variant="default" 
              className="gap-2 bg-emerald-600 hover:bg-emerald-700" 
              onClick={() => handleRunAllAutomations(false)}
              disabled={isRunningAll}
            >
              {isRunningAll ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
              Executar cron agora
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href="/integrations">
                <Settings2 size={18} /> Configurar Integrações
              </a>
            </Button>
          </div>

        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 border-emerald-500 bg-emerald-50/50">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-600">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="animate-pulse" />
                  Scheduler Active
                </div>
                <Badge className="bg-emerald-500">Executando</Badge>
              </div>
              <div className="flex justify-between items-baseline mt-2">
                <span className="text-muted-foreground text-[10px] uppercase">Próxima em:</span>
                <span className="text-xl font-mono font-bold text-primary">{nextRunIn}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Última: {automationStatus?.last_run ? new Date(automationStatus.last_run).toLocaleTimeString('pt-BR') : '--:--'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Processamento</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-bold">{automations.filter(a => a.enabled).length}</div>
                  <div className="text-[10px] uppercase text-emerald-600 font-bold">Ativas</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-muted-foreground">{automations.filter(a => !a.enabled).length}</div>
                  <div className="text-[10px] uppercase text-muted-foreground font-bold text-right">Inativas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Envios (Z-API)</div>
              <div className="flex gap-4">
                <div>
                  <div className="text-xl font-bold text-emerald-600">
                    {automationStatus?.messages_sent || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Sucesso</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-500">
                    {automationStatus?.messages_failed || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Falha</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Horário do Servidor</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                {(() => {
                  if (!serverInfo) return "--:--";
                  const elapsed = Date.now() - (serverInfo.fetch_time || 0);
                  const currentServerTime = new Date(new Date(serverInfo.server_time).getTime() + elapsed);
                  return currentServerTime.toLocaleTimeString('pt-BR');
                })()}
              </div>
              <div className="text-[10px] text-muted-foreground font-bold mt-1">
                {serverInfo?.timezone || 'America/Bahia'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="automations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-[1000px]">
            <TabsTrigger value="automations" className="gap-2"><Zap size={16} /> Automações</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2"><History size={16} /> Logs de Envio</TabsTrigger>
            <TabsTrigger value="debug" className="gap-2 text-red-500 font-bold"><AlertCircle size={16} /> Debug Webhook</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings2 size={16} /> Configurações</TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2"><MessageSquare size={16} /> Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {AUTOMATION_TYPES.map((item, index) => {
                const data = automations.find(a => a.type === item.id);
                const enabled = data?.enabled || false;
                const locked = isFeatureLocked(item.plan);
                const channel = data?.channel || 'whatsapp';
                const delay = data?.trigger_delay || 0;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={cn(
                      "relative overflow-hidden transition-all duration-500 hover:shadow-xl group border-2",
                      locked ? "opacity-80 bg-muted/30 grayscale-[0.5] border-transparent" : 
                      enabled 
                        ? "bg-card border-emerald-500/20 shadow-emerald-500/5 hover:border-emerald-500/40" 
                        : "bg-card border-red-500/20 shadow-red-500/5 hover:border-red-500/40"
                    )}>
                      {locked && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-500 border-amber-500/20 backdrop-blur-sm">
                            <Lock size={10} /> {item.plan.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                      
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className={cn(
                            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
                            item.bg,
                            enabled ? "text-emerald-600 shadow-lg shadow-emerald-500/10" : "text-red-600 shadow-lg shadow-red-500/10",
                            locked && "grayscale"
                          )}>
                            <item.icon size={26} />
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-3">
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={enabled ? "active" : "inactive"}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="flex items-center"
                                >
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider gap-1.5 transition-colors duration-300",
                                      enabled 
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                        : "bg-red-500/10 text-red-500 border-red-500/20"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full animate-pulse",
                                      enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                                    )} />
                                    {enabled ? "Ativo" : "Inativo"}
                                  </Badge>
                                </motion.div>
                              </AnimatePresence>
                              
                              <Switch 
                                id={`switch-${item.id}`}
                                checked={enabled} 
                                disabled={locked}
                                onCheckedChange={() => handleToggleAutomation(item.id, enabled)} 
                                className={cn(
                                  "transition-all duration-500",
                                  enabled ? "data-[state=checked]:bg-emerald-500" : "data-[state=unchecked]:bg-red-500/20",
                                  locked && "cursor-not-allowed opacity-20"
                                )}
                              />
                            </div>
                          </div>
                        </div>
                        <CardTitle className="text-xl mt-5 font-bold tracking-tight group-hover:text-primary transition-colors">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-sm leading-relaxed min-h-[40px]">
                          {item.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="py-4 border-y border-white/5 space-y-4 bg-muted/20">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <div className="p-1.5 rounded-md bg-background/50 border border-white/5">
                              {channel === 'whatsapp' ? <MessageSquare size={12} className="text-emerald-500" /> : <Mail size={12} className="text-blue-500" />}
                            </div>
                            <span>{channel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <div className="p-1.5 rounded-md bg-background/50 border border-white/5">
                              <Clock size={12} className="text-amber-500" />
                            </div>
                            <span>{delay === 0 ? "Imediato" : `${delay}h antes`}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className="text-muted-foreground/60">Gatilho:</span>
                            <span className="text-foreground">{item.trigger}</span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                            item.plan === 'starter' ? "bg-blue-500/10 text-blue-500" :
                            item.plan === 'pro' ? "bg-purple-500/10 text-purple-500" :
                            "bg-amber-500/10 text-amber-500"
                          )}>
                            <Sparkles size={8} /> {item.plan}
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="p-4 pt-4 flex gap-2">
                        {locked ? (
                          <Button variant="ghost" className="w-full h-11 gap-2 text-primary font-bold bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl group/btn" asChild>
                            <a href="/subscription">
                              <Zap size={16} className="text-amber-500 animate-pulse group-hover:scale-110 transition-transform" />
                              Upgrade para {item.plan.toUpperCase()}
                              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                          </Button>
                        ) : (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openEditModal(item.id)} 
                              className="flex-1 h-10 border-slate-200 hover:bg-black hover:text-white hover:scale-105 transition-all font-bold rounded-xl gap-2"
                            >
                              <Settings2 size={14} /> Configurar
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleTestAutomation(data || { type: item.id })}
                              disabled={isTesting === (data?.id || item.id)}
                              className="px-3 h-10 font-bold bg-slate-900 text-white hover:scale-105 transition-all rounded-xl gap-2"
                            >
                              {isTesting === (data?.id || item.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play size={14} />
                              )}
                              Testar
                            </Button>
                          </>
                        )}
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="border-white/5 bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <History size={20} />
                  </div>
                  Histórico de Envios
                </CardTitle>
                <CardDescription>Acompanhe em tempo real todas as interações automáticas enviadas para seus clientes.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-muted/30 border-y border-white/5">
                      <tr>
                        <th className="px-6 py-4">Automação</th>
                        <th className="px-6 py-4">Direção</th>
                        <th className="px-6 py-4">Cliente</th>
                        <th className="px-6 py-4">Telefone</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Conteúdo</th>
                        <th className="px-6 py-4 text-right">Data & Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2 opacity-50">
                              <History size={40} className="mb-2" />
                              <p className="font-medium">Nenhum registro de envio encontrado.</p>
                              <p className="text-xs">As atividades aparecerão aqui assim que as automações forem disparadas.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        logs.map((log, index) => (
                          <motion.tr 
                            key={log.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-muted/30 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                  {log.automations?.type?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold capitalize text-foreground/90 group-hover:text-primary transition-colors">
                                  {log.automations?.type?.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground/80">{log.customers?.name || `Cliente #${log.customer_id?.substring(0, 8)}`}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">ID: {log.id.substring(0, 6)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-muted-foreground tabular-nums">{log.phone || '-'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="outline" className="gap-1.5 py-0.5 bg-background font-bold text-[10px] uppercase">
                                <MessageSquare size={10} className="text-emerald-500" /> WhatsApp
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <Badge 
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none",
                                  log.status === 'success' || log.status === 'sent'
                                    ? "bg-emerald-500/10 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                                    : "bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                )}
                              >
                                {log.status === 'success' || log.status === 'sent' ? (
                                  <span className="flex items-center gap-1"><Check size={10} /> Sucesso</span>
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="flex items-center gap-1"><AlertCircle size={10} /> Falha</span>
                                    {log.error_message && <span className="text-[8px] lowercase block max-w-[100px] truncate">{log.error_message}</span>}
                                  </div>
                                )}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="max-w-[150px] truncate text-[11px] text-muted-foreground" title={log.processed_template}>
                                  {log.processed_template || '-'}
                                </div>
                                {log.metadata && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      setSelectedLog(log);
                                      setIsDebugDialogOpen(true);
                                    }}
                                  >
                                    <Sparkles size={12} />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-foreground/80 tabular-nums">
                                  {new Date(log.sent_at || log.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {new Date(log.sent_at || log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debug" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="text-primary" size={20} />
                    Simular Webhook
                  </CardTitle>
                  <CardDescription>
                    Envie um sinal de resposta manual para testar o fluxo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Telefone do Cliente (com DDI)</Label>
                    <Input id="debug-phone" placeholder="5511999999999" defaultValue="5511999999999" />
                  </div>
                  <div className="space-y-2">
                    <Label>Resposta (Texto ou Número)</Label>
                    <Input id="debug-text" placeholder="1" defaultValue="1" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full gap-2" 
                    onClick={() => {
                      const phone = (document.getElementById('debug-phone') as HTMLInputElement).value;
                      const text = (document.getElementById('debug-text') as HTMLInputElement).value;
                      handleTestWebhookManually(phone, text);
                    }}
                    disabled={isTestWebhookLoading}
                  >
                    {isTestWebhookLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    Executar Teste Manual
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-500" />
                    Conversas Ativas
                  </CardTitle>
                  <CardDescription>
                    Sessões de automação aguardando resposta do cliente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeConversations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conversa ativa no momento.</p>
                    ) : (
                      activeConversations.map(conv => (
                        <div key={conv.id} className="p-3 bg-muted rounded-lg border text-xs space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-bold">{conv.customers?.name || conv.phone}</span>
                            <Badge variant="outline" className="text-[9px] uppercase">{conv.current_state}</Badge>
                          </div>
                          <p className="text-muted-foreground">ID: {conv.id}</p>
                          <p className="text-muted-foreground">Expira em: {new Date(conv.expires_at).toLocaleString('pt-BR')}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Webhook Debug (Z-API)</CardTitle>
                  <CardDescription>
                    Últimos 10 payloads recebidos pela Z-API.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchDebugData}>
                  <RefreshCw size={14} className="mr-2" /> Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Origem</th>
                        <th className="px-3 py-2 text-left">Telefone</th>
                        <th className="px-3 py-2 text-left">Mensagem</th>
                        <th className="px-3 py-2 text-left">Tenant</th>
                        <th className="px-3 py-2 text-left">Conversa</th>
                        <th className="px-3 py-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum log de debug encontrado.</td>
                        </tr>
                      ) : (
                        debugLogs.map(log => (
                          <tr key={log.id} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(log.received_at).toLocaleTimeString('pt-BR')}
                            </td>
                            <td className="px-3 py-2">
                              {log.phone_raw || '-'}
                            </td>
                            <td className="px-3 py-2 max-w-[150px] truncate">
                              {log.message_text || log.payload_raw?.text?.message || '-'}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={log.tenant_id ? "default" : "destructive"} className="text-[9px]">
                                {log.tenant_id ? 'Identificado' : 'Falha'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={log.matched_conversation_id ? "outline" : "secondary"} className="text-[9px]">
                                {log.matched_conversation_id ? 'Encontrada' : 'Não'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setSelectedLog({
                                    ...log,
                                    metadata: {
                                      raw_payload: log.payload_raw,
                                      current_state: 'DEBUG_RAW'
                                    }
                                  });
                                  setIsDebugDialogOpen(true);
                                }}
                              >
                                <Settings2 size={12} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* A modal anterior foi removida em favor da nova modal de resumo manual que é mais completa */}


        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

            <DialogHeader>
              <DialogTitle>Configurar {selectedAutomation?.title}</DialogTitle>
              <DialogDescription>Personalize o canal e o conteúdo da mensagem.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Canal de Envio</Label>
                  <Select 
                    value={selectedAutomation?.channel} 
                    onValueChange={(val) => setSelectedAutomation({...selectedAutomation, channel: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="both">Ambos (WhatsApp + E-mail)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Atraso no Envio</Label>
                  <Select 
                    value={String(selectedAutomation?.trigger_delay)} 
                    onValueChange={(val) => setSelectedAutomation({...selectedAutomation, trigger_delay: parseInt(val)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Imediato</SelectItem>
                      <SelectItem value="5">5 Minutos</SelectItem>
                      <SelectItem value="15">15 Minutos</SelectItem>
                      <SelectItem value="30">30 Minutos</SelectItem>
                      <SelectItem value="60">1 Hora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Template da Mensagem</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary gap-2 h-8"
                    onClick={generateWithIA}
                    disabled={isIAExecuting}
                  >
                    {isIAExecuting ? <Clock className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Melhorar com IA
                  </Button>
                </div>
                <Textarea 
                  rows={6} 
                  value={selectedAutomation?.template}
                  onChange={(e) => setSelectedAutomation({...selectedAutomation, template: e.target.value})}
                  placeholder="Olá {{cliente_nome}}..."
                />
                <div className="flex flex-wrap gap-2">
                  {['cliente_nome', 'horario', 'data', 'profissional', 'servico', 'barbearia_nome'].map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer text-[10px]">
                      {"{{"}{tag}{"}}"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-black tracking-widest">Prévia da Mensagem</Label>
                <div className="bg-[#E7FFDB] dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/20 shadow-inner min-h-[100px] relative">
                  <div className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {selectedAutomation?.template ? selectedAutomation.template
                      .replace(/{{cliente_nome}}/g, 'João')
                      .replace(/{{barbearia_nome}}/g, 'Barbearia LM')
                      .replace(/{{data}}/g, '26/05/2026')
                      .replace(/{{horario}}/g, '14:30')
                      .replace(/{{profissional}}/g, 'Marcos')
                      .replace(/{{servico}}/g, 'Corte e Barba')
                      : 'Nenhum template definido'}
                  </div>
                  <div className="text-[10px] text-slate-400 absolute bottom-2 right-3">14:30 ✓✓</div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex gap-3">
                <AlertCircle className="text-primary shrink-0" size={20} />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-primary">Dica Pro:</p>
                  <p className="text-muted-foreground">As variáveis em entre chaves duplas {"{{ }}"} serão substituídas automaticamente pelos dados reais no momento do envio.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
              <Button onClick={saveAutomation}>Salvar Configurações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isManualSummaryOpen} onOpenChange={setIsManualSummaryOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" />
                Resumo da Execução {executionSummary?.forceMode ? "(MODO FORÇADO)" : ""}
              </DialogTitle>
              <DialogDescription>
                Detalhamento técnico da última execução das automações.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{executionSummary?.summary?.records_found || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Encontrados</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-emerald-600">{executionSummary?.summary?.messages_sent || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Enviados</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{executionSummary?.summary?.ignored || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Ignorados</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">{executionSummary?.summary?.messages_failed || 0}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Falhas</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} /> Detalhes do Servidor
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Horário Servidor:</span>
                    <p className="font-mono">{executionSummary?.serverTime ? new Date(executionSummary.serverTime).toLocaleTimeString('pt-BR') : '---'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timezone:</span>
                    <p className="font-mono">{executionSummary?.timezone || 'America/Bahia'}</p>
                  </div>
                </div>
              </div>

              {executionSummary?.ignoredRecords?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-amber-600">
                      <History size={16} /> Registros Ignorados / Debug
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {executionSummary.ignoredRecords.map((item: any, idx: number) => (
                      <div key={idx} className="bg-muted/30 p-3 rounded-lg border border-dashed text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-primary capitalize">{item.type || 'Geral'}</span>
                          <Badge variant="outline" className="text-[10px]">{item.customer_name || 'Agendamento'}</Badge>
                        </div>
                        <p className="text-muted-foreground">{item.reason}</p>
                        {item.debug && (
                          <pre className="text-[9px] bg-black/5 p-1 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(item.debug, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {executionSummary?.messagesSent?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-600">
                      <Check size={16} /> Mensagens Processadas
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {executionSummary.messagesSent.map((item: any, idx: number) => (
                      <div key={idx} className={cn(
                        "p-3 rounded-lg border text-xs flex justify-between items-center",
                        item.status === 'success' ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                      )}>
                        <div>
                          <p className="font-bold">{item.customer_name}</p>
                          <p className="text-muted-foreground text-[10px]">{item.phone}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={item.status === 'success' ? 'default' : 'destructive'} className={item.status === 'success' ? "bg-emerald-500" : ""}>
                            {item.status === 'success' ? 'Enviado' : 'Erro'}
                          </Badge>
                          {item.error_message && <p className="text-[9px] text-red-500 mt-1 max-w-[200px] truncate">{item.error_message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setIsManualSummaryOpen(false)}>Fechar Resumo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDebugDialogOpen} onOpenChange={setIsDebugDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles size={20} className="text-primary" />
                Diagnóstico de Automação
              </DialogTitle>
              <DialogDescription>
                Detalhes técnicos da interação recebida via WhatsApp.
              </DialogDescription>
            </DialogHeader>

            {selectedLog && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Telefone Recebido</span>
                    <p className="font-mono text-sm">{selectedLog.phone}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Telefone Normalizado</span>
                    <p className="font-mono text-sm">{selectedLog.metadata?.normalized_phone || '-'}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Conversa Encontrada</span>
                    <Badge variant={selectedLog.conversation_id ? "default" : "destructive"} className="uppercase text-[9px] h-auto py-0.5">
                      {selectedLog.conversation_id ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Estado Atual</span>
                    <Badge variant="outline" className="uppercase text-[9px] border-primary/20 text-primary h-auto py-0.5">
                      {selectedLog.metadata?.current_state || '-'}
                    </Badge>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Resposta do Cliente</span>
                    <p className="font-bold text-sm">"{selectedLog.processed_template || '-'}"</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Opção Identificada</span>
                    <Badge className="bg-emerald-500 uppercase text-[9px] h-auto py-0.5">
                      {selectedLog.option_id || '-'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Ação Executada</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="font-semibold text-emerald-600">{selectedLog.metadata?.action_executed || 'Nenhuma'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Próximo estado: <span className="font-mono">{selectedLog.metadata?.next_state || '-'}</span></p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payload Bruto (Z-API)</Label>
                  <pre className="p-4 bg-black/90 text-emerald-400 rounded-xl overflow-x-auto text-[10px] font-mono border border-white/10 max-h-[200px]">
                    {JSON.stringify(selectedLog.metadata?.raw_payload || selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsDebugDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default AutomationsComponent;
