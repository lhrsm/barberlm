
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
  Clock
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationEditModal } from "@/components/admin/automations/AutomationEditModal";
import { AutomationTestModal } from "@/components/admin/automations/AutomationTestModal";

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);

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

      // 3. Fetch logs
      const { data: logsData } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      setLogs(logsData || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Automações</h2>
            <p className="text-muted-foreground">Gerencie suas automações de atendimento, notificações e comunicações com clientes.</p>
          </div>
          <Button onClick={fetchData} variant="outline" size="icon">
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
          </Button>
        </div>

        <Tabs defaultValue="templates">
          <TabsList className="bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="templates">Modelos de Mensagem</TabsTrigger>
            <TabsTrigger value="logs">Histórico de Envios</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4 pt-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {automations.map((auto) => (
                <Card key={auto.id} className="flex flex-col bg-white dark:bg-slate-900 border shadow-sm overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                        <Zap size={20} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                          {auto.active ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch 
                          checked={auto.active || false} 
                          onCheckedChange={() => toggleStatus(auto)}
                        />
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-4">{auto.name}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                        {auto.trigger_event}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 capitalize">
                        {auto.channel}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 min-h-[100px]">
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-6 whitespace-pre-wrap">
                        {auto.template}
                      </p>
                    </div>
                  </CardContent>
                  <div className="p-4 bg-slate-50/50 border-t flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-2 bg-white"
                      onClick={() => openEdit(auto)}
                    >
                      <Settings2 size={14} /> Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 bg-white"
                      onClick={() => openTest(auto)}
                    >
                      <Play size={14} /> Testar
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
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History size={18} /> Histórico de Envios
                </CardTitle>
                <CardDescription>
                  Acompanhe as últimas mensagens enviadas pelo sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data/Hora</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Automação</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Canal</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Destinatário</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
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
    </AppLayout>
  );
}

export default AutomationsComponent;
