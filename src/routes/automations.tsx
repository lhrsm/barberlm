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
  CheckCircle2,
  AlertCircle,
  Zap,
  Lock,
  ArrowRight,
  Sparkles
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
  {
    id: "appointment_confirmation",
    title: "Confirmação de Agendamento",
    description: "Enviado assim que o cliente realiza um novo agendamento.",
    icon: CalendarCheck,
    color: "text-blue-500",
    bg: "bg-blue-50",
    trigger: "Novo Agendamento",
    plan: "starter"
  },
  {
    id: "appointment_reminder",
    title: "Lembrete de Agendamento",
    description: "Lembre o cliente do seu horário (24h ou 2h antes).",
    icon: BellRing,
    color: "text-amber-500",
    bg: "bg-amber-50",
    trigger: "Horário Próximo",
    plan: "starter"
  },
  {
    id: "rescheduling",
    title: "Reagendamento",
    description: "Notifica sobre mudanças de horário ou profissional.",
    icon: Clock,
    color: "text-purple-500",
    bg: "bg-purple-50",
    trigger: "Alteração de Horário",
    plan: "pro"
  },
  {
    id: "cancellation",
    title: "Cancelamento",
    description: "Enviado quando um agendamento é cancelado.",
    icon: Ban,
    color: "text-red-500",
    bg: "bg-red-50",
    trigger: "Agendamento Cancelado",
    plan: "pro"
  },
  {
    id: "birthday",
    title: "Mensagem de Aniversário",
    description: "Parabenize e ofereça mimos aos seus clientes no dia especial.",
    icon: Gift,
    color: "text-pink-500",
    bg: "bg-pink-50",
    trigger: "Data de Nascimento",
    plan: "pro"
  },
  {
    id: "inactive_customer",
    title: "Cliente Inativo",
    description: "Recupere clientes que não aparecem há mais de 30 dias.",
    icon: UserMinus,
    color: "text-orange-500",
    bg: "bg-orange-50",
    trigger: "Inatividade (30 dias)",
    plan: "pro"
  },
  {
    id: "post_service",
    title: "Pós-Atendimento",
    description: "Solicite avaliações 1h após a conclusão do serviço.",
    icon: Star,
    color: "text-green-500",
    bg: "bg-green-50",
    trigger: "Serviço Concluído",
    plan: "pro"
  }
];

function AutomationsComponent() {
  const { user, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { plan } = usePlanLimits();
  const navigate = useNavigate();
  
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isIAExecuting, setIsIAExecuting] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchAutomations();
      fetchLogs();
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
      .select("*, automations(type)")
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false })
      .limit(20);
    
    if (data) setLogs(data);
  }

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
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <a href="/integrations">
                <Settings2 size={18} /> Configurar Integrações
              </a>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="all" className="gap-2">
              <Zap size={16} /> Automações
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History size={16} /> Logs de Envio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {AUTOMATION_TYPES.map((item) => {
                const data = automations.find(a => a.type === item.id);
                const enabled = data?.enabled || false;
                const locked = isFeatureLocked(item.plan);

                return (
                  <Card key={item.id} className={cn(
                    "relative overflow-hidden transition-all hover:shadow-md",
                    locked ? "opacity-70 bg-muted/30" : "bg-card"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className={cn("p-2 rounded-lg", item.bg, item.color)}>
                          <item.icon size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                          {locked ? (
                            <Badge variant="secondary" className="gap-1">
                              <Lock size={10} /> {item.plan.toUpperCase()}
                            </Badge>
                          ) : (
                            <Switch 
                              checked={enabled} 
                              onCheckedChange={() => handleToggleAutomation(item.id, enabled)} 
                            />
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-xl mt-4">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Play size={12} /> Trigger: {item.trigger}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t">
                      {locked ? (
                        <Button variant="ghost" className="w-full gap-2 text-primary" asChild>
                          <a href="/subscription">Fazer Upgrade <ArrowRight size={14} /></a>
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 w-full gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(item.id)}>
                            Configurar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toast.info("Automação de teste enviada!")}>
                            Testar
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Automações</CardTitle>
                <CardDescription>Acompanhe todas as mensagens enviadas automaticamente pelo sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="p-4 border-b bg-muted/50 grid grid-cols-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <div>Automação</div>
                    <div>Cliente</div>
                    <div>Status</div>
                    <div className="text-right">Data/Hora</div>
                  </div>
                  <div className="divide-y">
                    {logs.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado.</div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="p-4 grid grid-cols-4 items-center text-sm">
                          <div className="font-medium capitalize">{log.automations?.type.replace('_', ' ')}</div>
                          <div className="text-muted-foreground">Cliente #{log.customer_id?.substring(0, 5)}</div>
                          <div>
                            <Badge variant={log.status === 'sent' ? "default" : "destructive"} className={log.status === 'sent' ? "bg-green-500" : ""}>
                              {log.status === 'sent' ? 'Enviado' : 'Falhou'}
                            </Badge>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {new Date(log.sent_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
      </div>
    </AppLayout>
  );
}

export default AutomationsComponent;
