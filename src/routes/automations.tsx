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
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Zap,
  Smartphone,
  Pencil,
  Send
} from "lucide-react";
import { WorkflowEditModal } from "@/components/admin/automations/WorkflowEditModal";
import { WorkflowTestModal } from "@/components/admin/automations/WorkflowTestModal";

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
  
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [w, q, s, l, wl] = await Promise.all([
        supabase.from("automation_v2_workflows").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }),
        supabase.from("automation_v2_queue").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("automation_v2_sessions").select("*, customers(name)").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("automation_v2_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("automation_v2_webhook_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
      ]);

      if (w.data) {
        // Fetch metrics for each workflow
        const workflowsWithMetrics = await Promise.all(w.data.map(async (wf) => {
          const { count: sentCount } = await supabase
            .from("automation_v2_queue")
            .select('*', { count: 'exact', head: true })
            .eq("workflow_key", wf.workflow_key)
            .eq("status", "completed");
          
          const { count: errorCount } = await supabase
            .from("automation_v2_queue")
            .select('*', { count: 'exact', head: true })
            .eq("workflow_key", wf.workflow_key)
            .eq("status", "failed");

          const { data: lastRun } = await supabase
            .from("automation_v2_queue")
            .select("finished_at")
            .eq("workflow_key", wf.workflow_key)
            .eq("status", "completed")
            .order("finished_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...wf,
            metrics: {
              sent: sentCount || 0,
              failed: errorCount || 0,
              lastRun: lastRun?.finished_at || null
            }
          };
        }));
        setWorkflows(workflowsWithMetrics);
      }
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

  const handleEdit = (workflow: any) => {
    setSelectedWorkflow(workflow);
    setIsEditModalOpen(true);
  };

  const handleTest = (workflow: any) => {
    setSelectedWorkflow(workflow);
    setIsTestModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automações v2</h1>
            <p className="text-muted-foreground text-amber-500 font-medium">Novo Motor de Automação (Arquitetura Limpa)</p>
          </div>
          <Button onClick={handleRunEngine} disabled={isProcessing} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Processar Fila v2
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-zinc-900 border-zinc-800 p-1">
            <TabsTrigger value="automations" className="data-[state=active]:bg-zinc-800">Fluxos</TabsTrigger>
            <TabsTrigger value="queue" className="data-[state=active]:bg-zinc-800">Fila</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-zinc-800">Sessões</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-zinc-800">Logs</TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-zinc-800">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-4 pt-4">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {workflows.map(w => (
                  <Card key={w.id} className="border-zinc-800 bg-zinc-950/50 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 flex flex-col group overflow-hidden">
                    <CardHeader className="pb-3 border-b border-zinc-900/50">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-bold group-hover:text-amber-500 transition-colors">{w.name}</CardTitle>
                          <CardDescription className="font-mono text-[10px] text-zinc-500">{w.workflow_key}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-900/50 px-2 py-1 rounded-full border border-zinc-800">
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
                            className="data-[state=checked]:bg-amber-500 border-zinc-700"
                          />
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            w.active ? "text-amber-500" : "text-zinc-600"
                          )}>
                            {w.active ? 'Ativo' : 'Off'}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4 pt-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 py-1">
                          <Zap size={10} className="mr-1 text-amber-500" /> {w.event_name}
                        </Badge>
                        {w.configuration?.flow_type && (
                          <Badge variant="outline" className={cn(
                            "py-1",
                            w.configuration.flow_type === 'multi' ? 'border-purple-500/30 text-purple-400 bg-purple-500/5' : 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                          )}>
                            {w.configuration.flow_type === 'multi' ? 'Multi-Passo' : 'Fluxo Único'}
                          </Badge>
                        )}
                      </div>

                      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 relative">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold flex items-center gap-1">
                          <Send size={10} /> Preview do Template
                        </p>
                        <p className="text-xs text-zinc-400 whitespace-pre-wrap line-clamp-3 italic leading-relaxed">
                          "{w.configuration?.template || 'Sem template configurado'}"
                        </p>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Badge className="bg-amber-500/10 text-amber-500 border-none text-[8px] h-4">Visualizar</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 border-t border-zinc-900/50">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-600 uppercase font-bold">Enviados</span>
                          <span className="font-bold text-zinc-200 text-sm">{w.metrics?.sent || 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-600 uppercase font-bold">Falhas</span>
                          <span className="font-bold text-red-500/70 text-sm">{w.metrics?.failed || 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-600 uppercase font-bold">Último</span>
                          <span className="font-bold text-zinc-400 text-[10px]">
                            {w.metrics?.lastRun ? new Date(w.metrics.lastRun).toLocaleDateString() : 'Nuncas'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto flex gap-2">
                       <Button 
                        onClick={() => handleEdit(w)}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold h-9 rounded-md transition-all active:scale-95"
                       >
                         <Pencil size={14} className="mr-2" /> Editar
                       </Button>
                       <Button 
                        variant="outline" 
                        onClick={() => handleTest(w)}
                        className="border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black h-9 px-3 rounded-md transition-all active:scale-95"
                        title="Testar Envio"
                       >
                         <Play size={14} />
                       </Button>
                    </div>
                  </Card>
                ))}
                {workflows.length === 0 && !loading && (
                  <Card className="col-span-full p-12 text-center border-dashed border-zinc-800">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-zinc-800" />
                    <p className="text-muted-foreground">Nenhuma automação encontrada.</p>
                  </Card>
                )}
                {loading && (
                   <div className="col-span-full flex flex-col items-center justify-center p-12">
                     <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                     <p className="text-zinc-500 text-sm">Carregando motor de automações...</p>
                   </div>
                )}
             </div>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Workflow</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Tipo</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Agendado para</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map(item => (
                        <tr key={item.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-200">{item.workflow_key}</span>
                              <span className="text-[10px] text-zinc-500">ID: {item.id.substr(0,8)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={cn(
                              "border-none px-2 py-0.5",
                              item.flow_type === 'multi' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                            )}>
                              {item.flow_type}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                             <Badge className={cn(
                               "border-none",
                               item.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                               item.status === 'failed' ? 'bg-red-500/10 text-red-500' : 
                               'bg-amber-500/10 text-amber-500'
                             )}>
                               {item.status}
                             </Badge>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs">
                            {new Date(item.scheduled_for).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Button variant="ghost" size="sm" className="text-amber-500 hover:bg-amber-500/10 h-8 w-8 p-0">
                               <RefreshCw size={14} />
                             </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map(s => (
                <Card key={s.id} className="border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <Smartphone className="text-amber-500" size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-200">{s.customers?.name || s.phone}</p>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                          {s.phone} <span className="text-zinc-700">•</span> {s.flow_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px] h-5">
                        {s.current_step}
                      </Badge>
                      <p className="text-[9px] text-zinc-600 font-mono">{new Date(s.updated_at).toLocaleTimeString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg flex gap-4 text-sm hover:border-zinc-800 transition-colors">
                <div className={cn(
                  "mt-1 p-1.5 rounded-full h-fit",
                  log.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                )}>
                   {log.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200">{log.action}</span>
                        <Badge variant="outline" className="text-[8px] h-4 border-zinc-800 text-zinc-500">{log.event_name}</Badge>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                   </div>
                   <p className="text-zinc-400 text-xs leading-relaxed">{log.message}</p>
                   {log.error && (
                     <div className="mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded text-red-400 text-[10px] font-mono whitespace-pre-wrap">
                       {log.error}
                     </div>
                   )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
             <div className="grid gap-4">
              {webhookLogs.map(log => (
                <Card key={log.id} className="bg-black/40 border-zinc-800 font-mono text-[10px] hover:border-zinc-700 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between border-b border-zinc-800/50 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold",
                            log.processed ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                          )}>
                            {log.processed ? "PROCESSADO" : "PENDENTE"}
                          </span>
                          <span className="text-zinc-500">#{log.id.substr(0,6)}</span>
                        </div>
                        <span className="text-zinc-600">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-600 uppercase text-[8px] font-bold">Telefone</span>
                          <span className="text-zinc-300">{log.phone_normalized}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-600 uppercase text-[8px] font-bold">Interação</span>
                          <span className="text-zinc-300">{log.button_id ? `BOTÃO: ${log.button_id}` : 'MENSAGEM DE TEXTO'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-600 uppercase text-[8px] font-bold">Referência</span>
                          <span className="text-zinc-300">{log.reference_message_id ? `${log.reference_message_id.substr(0,12)}...` : 'N/A'}</span>
                        </div>
                    </div>
                    <details className="group">
                        <summary className="text-amber-500/60 hover:text-amber-500 cursor-pointer text-[9px] font-bold uppercase tracking-widest list-none flex items-center gap-1">
                          <span>▸</span> Ver Payload Bruto
                        </summary>
                        <pre className="p-4 bg-zinc-950 border border-zinc-900 mt-2 rounded-lg overflow-x-auto text-zinc-500 text-[9px] max-h-[300px]">
                          {JSON.stringify(log.raw_payload, null, 2)}
                        </pre>
                    </details>
                  </CardContent>
                </Card>
              ))}
             </div>
          </TabsContent>
        </Tabs>
      </div>

      <WorkflowEditModal 
        workflow={selectedWorkflow}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchData}
      />

      <WorkflowTestModal 
        workflow={selectedWorkflow}
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </AppLayout>
  );
}
