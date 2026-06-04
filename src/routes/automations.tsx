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
  MessageSquare, 
  History, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Search,
  Trash2,
  Plus,
  Clock,
  Zap,
  Smartphone
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/automations")({
  component: AutomationsV2Component,
});

function AutomationsV2Component() {
  const { tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState("automations");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [w, q, s, l, wl] = await Promise.all([
        supabase.from("automation_v2_workflows").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("automation_v2_queue").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("automation_v2_sessions").select("*, customers(name)").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("automation_v2_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("automation_v2_webhook_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
      ]);

      if (w.data) setWorkflows(w.data);
      if (q.data) setQueue(q.data);
      if (s.data) setSessions(s.data);
      if (l.data) setLogs(l.data);
      if (wl.data) setWebhookLogs(wl.data);
    } catch (error) {
      console.error("Error fetching automation v2 data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('automation_v2_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_v2_queue' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_v2_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_v2_webhook_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_v2_sessions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const handleRunEngine = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('automation-v2-runner', { body: { tenantId } });
      if (error) throw error;
      toast.success("Motor v2 executado!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro no motor v2: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automações v2</h1>
            <p className="text-muted-foreground text-amber-500 font-medium">Novo Motor de Automação (Arquitetura Limpa)</p>
          </div>
          <Button onClick={handleRunEngine} disabled={isProcessing} className="bg-amber-500 hover:bg-amber-600 text-black">
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Processar Fila v2
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-zinc-900 border-zinc-800">
            <TabsTrigger value="automations">Fluxos</TabsTrigger>
            <TabsTrigger value="queue">Fila</TabsTrigger>
            <TabsTrigger value="sessions">Sessões</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workflows.map(w => (
                  <Card key={w.id} className="border-zinc-800 flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{w.name}</CardTitle>
                          <CardDescription className="font-mono text-[10px]">{w.workflow_key}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">{w.active ? 'Ativo' : 'Inativo'}</span>
                          <Switch 
                            checked={w.active} 
                            onCheckedChange={async (checked) => {
                              try {
                                const { error } = await supabase
                                  .from("automation_v2_workflows")
                                  .update({ active: checked })
                                  .eq("id", w.id);
                                if (error) throw error;
                                toast.success(`${w.name} ${checked ? 'ativado' : 'desativado'}`);
                                fetchData();
                              } catch (err: any) {
                                toast.error("Erro ao atualizar status: " + err.message);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-zinc-900 border-zinc-700 text-zinc-400">
                          <Zap size={10} className="mr-1" /> {w.event_name}
                        </Badge>
                        {w.configuration?.flow_type && (
                          <Badge variant="outline" className={cn(
                            "border-zinc-700 text-zinc-400",
                            w.configuration.flow_type === 'multi' ? 'border-purple-500/50 text-purple-400' : 'border-blue-500/50 text-blue-400'
                          )}>
                            {w.configuration.flow_type}
                          </Badge>
                        )}
                        {w.configuration?.recipient && (
                          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                            Destino: {w.configuration.recipient}
                          </Badge>
                        )}
                      </div>

                      <div className="bg-zinc-950 border border-zinc-900 rounded-md p-3">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">Template Preview</p>
                        <p className="text-xs text-zinc-400 whitespace-pre-wrap line-clamp-4 italic">
                          "{w.configuration?.template || 'Sem template configurado'}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 pt-2 border-t border-zinc-900">
                        <div className="flex flex-col">
                          <span className="text-zinc-600">Total Enviado</span>
                          <span className="font-bold text-zinc-300">0</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-600">Falhas</span>
                          <span className="font-bold text-red-500/70">0</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto flex gap-2">
                       <Button variant="outline" size="sm" className="flex-1 border-zinc-800 text-zinc-400 hover:text-white h-8">
                         Editar
                       </Button>
                       <Button variant="outline" size="sm" className="border-zinc-800 text-amber-500 hover:text-amber-400 h-8" title="Testar Envio">
                         <Play size={12} />
                       </Button>
                    </div>
                  </Card>
                ))}
                {workflows.length === 0 && (
                  <Card className="col-span-full p-12 text-center border-dashed border-zinc-800">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-zinc-600" />
                    <p className="text-muted-foreground">Carregando fluxos v2...</p>
                  </Card>
                )}
             </div>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card className="border-zinc-800">
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Workflow</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Agendado</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(item => (
                      <tr key={item.id} className="border-b border-zinc-800">
                        <td className="px-4 py-3 font-medium">{item.workflow_key}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={item.flow_type === 'multi' ? 'border-purple-500' : 'border-blue-500'}>
                            {item.flow_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                           <Badge className={item.status === 'completed' ? 'bg-green-600' : item.status === 'failed' ? 'bg-red-600' : 'bg-amber-600'}>
                             {item.status}
                           </Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{new Date(item.scheduled_for).toLocaleString()}</td>
                        <td className="px-4 py-3">
                           <Button variant="ghost" size="sm" className="text-amber-500"><RefreshCw size={14} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <div className="grid gap-4">
              {sessions.map(s => (
                <Card key={s.id} className="border-zinc-800 bg-zinc-950">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-full"><Smartphone className="text-amber-500" size={20} /></div>
                      <div>
                        <p className="font-bold">{s.customers?.name || s.phone}</p>
                        <p className="text-xs text-zinc-500">{s.phone} • {s.flow_type}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="outline" className="border-amber-500 text-amber-500">{s.current_step}</Badge>
                      <p className="text-[10px] text-zinc-600">{new Date(s.updated_at).toLocaleTimeString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="p-3 border-b border-zinc-800 flex gap-3 text-sm">
                <div className={log.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                   {log.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                </div>
                <div className="flex-1">
                   <div className="flex justify-between">
                      <span className="font-bold">{log.action}</span>
                      <span className="text-[10px] text-zinc-600">{new Date(log.created_at).toLocaleString()}</span>
                   </div>
                   <p className="text-zinc-400">{log.message}</p>
                   {log.error && <p className="text-red-400 text-xs mt-1">{log.error}</p>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
             {webhookLogs.map(log => (
               <Card key={log.id} className="bg-black border-zinc-800 font-mono text-[10px]">
                 <CardContent className="p-3">
                   <div className="flex justify-between border-b border-zinc-800 pb-1 mb-2">
                      <span className={log.processed ? "text-green-500" : "text-amber-500"}>
                        {log.processed ? "PROCESSADO" : "RECEBIDO"}
                      </span>
                      <span className="text-zinc-600">{new Date(log.created_at).toLocaleString()}</span>
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                      <span className="text-zinc-400">Fone: {log.phone_normalized}</span>
                      <span className="text-zinc-400">Botão: {log.button_id || 'texto'}</span>
                      <span className="text-zinc-400">Ref: {log.reference_message_id?.substr(0,8)}...</span>
                   </div>
                   <details className="mt-1">
                      <summary className="text-zinc-600 cursor-pointer">Ver Payload</summary>
                      <pre className="p-2 bg-zinc-900 mt-1 rounded overflow-x-auto">
                        {JSON.stringify(log.raw_payload, null, 2)}
                      </pre>
                   </details>
                 </CardContent>
               </Card>
             ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
