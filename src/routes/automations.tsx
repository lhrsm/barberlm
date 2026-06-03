import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  Play, 
  Settings2, 
  MessageSquare, 
  History, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";


export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

function AutomationsComponent() {
  const { tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState("automations");
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    
    try {
      const [w, q, s, l, p] = await Promise.all([
        supabase.from("automation_workflows").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("automation_queue").select("*, automation_events(*), automation_workflows(*)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
        supabase.from("conversation_sessions").select("*, customers(name)").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("automation_logs").select("*, automation_workflows(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30),
        supabase.from("messaging_providers").select("*").eq("tenant_id", tenantId)
      ]);

      if (w.data) setWorkflows(w.data);
      if (q.data) setQueue(q.data);
      if (s.data) setSessions(s.data);
      if (l.data) setLogs(l.data);
      if (p.data) setProviders(p.data);
    } catch (error) {
      console.error("Error fetching automation data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const channel = supabase.channel('automation_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_queue' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_sessions' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleToggleWorkflow = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("automation_workflows")
      .update({ active })
      .eq("id", id);
    
    if (error) toast.error("Erro ao atualizar fluxo");
    else {
      toast.success(active ? "Fluxo ativado" : "Fluxo desativado");
      fetchData();
    }
  };

  const handleRunEngine = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('automation-engine', {
        body: { tenantId }
      });
      if (error) throw error;
      toast.success("Motor de automação executado com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao executar motor: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateEvent = async (eventName: string) => {
    if (!tenantId) return;
    try {
      // Find a recent appointment to use as base
      const { data: appt } = await supabase.from("appointments").select("id").eq("tenant_id", tenantId).limit(1).single();
      
      if (!appt) {
        toast.error("Nenhum agendamento encontrado para simular evento.");
        return;
      }

      const { error } = await supabase.from("automation_events").insert({
        tenant_id: tenantId,
        event_name: eventName,
        entity_type: 'appointment',
        entity_id: appt.id,
        payload: { simulated: true, at: new Date().toISOString() }
      });

      if (error) throw error;
      toast.success(`Evento ${eventName} simulado com sucesso!`);
      
      // Auto-run engine after simulation
      setTimeout(handleRunEngine, 1000);
    } catch (error: any) {
      toast.error("Erro ao simular evento: " + error.message);
    }
  };


  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Motor de Automação</h1>
            <p className="text-muted-foreground">Arquitetura universal de eventos e workflows.</p>
          </div>
          <Button 
            onClick={handleRunEngine} 
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Processar Fila Agora
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-full justify-start border-b rounded-none bg-transparent h-12 p-0">
              <TabsTrigger value="automations" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Automações</TabsTrigger>
              <TabsTrigger value="queue" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Fila</TabsTrigger>
              <TabsTrigger value="conversations" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Conversas</TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Logs</TabsTrigger>
              <TabsTrigger value="webhooks" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Webhooks</TabsTrigger>
              <TabsTrigger value="tests" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Testes</TabsTrigger>
              <TabsTrigger value="integrations" className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent">Integrações</TabsTrigger>
            </TabsList>
          </ScrollArea>
          
          {/* ABA 1: AUTOMAÇÕES */}
          <TabsContent value="automations" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
            {workflows.map((w) => (
              <Card key={w.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{w.name}</CardTitle>
                    <Switch 
                      checked={w.active} 
                      onCheckedChange={(checked) => handleToggleWorkflow(w.id, checked)}
                    />
                  </div>
                  <CardDescription>Gatilho: <Badge variant="secondary">{w.trigger_event}</Badge></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground line-clamp-2 italic">
                    "{w.configuration?.template || 'Sem template configurado'}"
                  </div>
                </CardContent>
                <div className="p-4 border-t flex gap-2">
                  <Button variant="outline" size="sm" className="w-full">Editar</Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleSimulateEvent(w.trigger_event)}>Testar</Button>
                </div>
              </Card>
            ))}
            {workflows.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhuma automação configurada.
              </div>
            )}
          </TabsContent>

          {/* ABA 2: FILA */}
          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Itens na Fila</CardTitle></CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted">
                      <tr>
                        <th className="px-4 py-2">Workflow</th>
                        <th className="px-4 py-2">Evento</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Tentativas</th>
                        <th className="px-4 py-2">Agendado para</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="px-4 py-3 font-medium">{item.automation_workflows?.name || 'Workflow Removido'}</td>
                          <td className="px-4 py-3">{item.automation_events?.event_name}</td>
                          <td className="px-4 py-3">
                            <Badge className={
                              item.status === 'completed' ? 'bg-green-500' :
                              item.status === 'failed' ? 'bg-red-500' :
                              item.status === 'processing' ? 'bg-blue-500' :
                              'bg-amber-500'
                            }>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">{item.attempts}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.scheduled_for ? new Date(item.scheduled_for).toLocaleString('pt-BR') : '-'}
                          </td>
                        </tr>

                      ))}
                    </tbody>
                  </table>
                  {queue.length === 0 && <p className="py-8 text-center text-muted-foreground">Fila vazia.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* ABA 3: CONVERSAS */}
          <TabsContent value="conversations" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Sessões de Conversa Ativas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-2 rounded-full">
                          <MessageSquare className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{s.customers?.name || s.phone}</p>
                          <p className="text-xs text-muted-foreground">{s.phone} • WhatsApp</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">{s.current_step}</Badge>
                          <p className="text-[10px] text-muted-foreground">Atualizado: {new Date(s.updated_at).toLocaleTimeString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma sessão ativa.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 4: LOGS */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Histórico de Logs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.filter(l => !l.event_name?.startsWith('whatsapp.')).map((log) => (
                    <div key={log.id} className="flex gap-4 p-3 border-b last:border-0 items-start">
                      <div className={cn(
                        "mt-1 p-1 rounded-full",
                        log.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                      )}>
                        {log.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <p className="font-semibold text-sm">{log.automation_workflows?.name || log.event_name || 'Sistema'}</p>
                          <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                        {log.error_details && <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto">{log.error_details}</pre>}
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum log encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 5: WEBHOOKS */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Webhooks Recebidos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.filter(l => l.event_name?.startsWith('whatsapp.')).map((log) => (
                    <div key={log.id} className="p-4 border rounded-lg bg-black text-green-400 font-mono text-xs overflow-hidden">
                      <div className="flex justify-between border-b border-green-900 pb-2 mb-2">
                        <span>{log.event_name}</span>
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap truncate">
                        {log.error_details}
                      </div>
                    </div>
                  ))}
                  {logs.filter(l => l.event_name?.startsWith('whatsapp.')).length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">Nenhum webhook recente.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 6: TESTES */}
          <TabsContent value="tests" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleSimulateEvent('appointment.created')}>
              <Zap className="w-6 h-6 text-yellow-500" />
              <span>appointment.created</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleSimulateEvent('appointment.confirmed')}>
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <span>appointment.confirmed</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleSimulateEvent('appointment.cancelled')}>
              <AlertCircle className="w-6 h-6 text-red-500" />
              <span>appointment.cancelled</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleSimulateEvent('customer.birthday')}>
              <History className="w-6 h-6 text-pink-500" />
              <span>customer.birthday</span>
            </Button>
          </TabsContent>

          {/* ABA 7: INTEGRAÇÕES */}
          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Canais de Comunicação</CardTitle>
                <CardDescription>Configure os provedores para envio de mensagens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-6 border rounded-xl bg-muted/30">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center p-2">
                      <img src="https://z-api.io/wp-content/uploads/2021/08/z-api-logo-azul.png" alt="Z-API" className="max-w-full" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Z-API</h3>
                      <p className="text-sm text-muted-foreground">Instância conectada via API.</p>
                      <Badge className="mt-2 bg-green-500">Conectado</Badge>
                    </div>
                  </div>
                  <Button variant="outline">Configurar</Button>
                </div>

                <div className="flex items-center justify-between p-6 border rounded-xl opacity-50 grayscale cursor-not-allowed">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center p-2 font-bold text-blue-600">
                      Evolution
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Evolution API</h3>
                      <p className="text-sm text-muted-foreground">Conexão direta com instâncias Evolution.</p>
                      <Badge variant="secondary" className="mt-2">Em breve</Badge>
                    </div>
                  </div>
                  <Button variant="outline" disabled>Ativar</Button>
                </div>

                <div className="flex items-center justify-between p-6 border rounded-xl opacity-50 grayscale cursor-not-allowed">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center p-2 font-bold text-blue-800">
                      Meta
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Meta Cloud API</h3>
                      <p className="text-sm text-muted-foreground">API Oficial do WhatsApp Business.</p>
                      <Badge variant="secondary" className="mt-2">Em breve</Badge>
                    </div>
                  </div>
                  <Button variant="outline" disabled>Ativar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
