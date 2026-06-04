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
  Plus,
  Play,
  Settings2,
  Trash2,
  History
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

function AutomationsComponent() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [tplRes, logsRes] = await Promise.all([
        supabase.from("whatsapp_templates").select("*").eq("user_id", tenantId).order("name"),
        supabase.from("automation_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20)
      ]);

      if (tplRes.data) setTemplates(tplRes.data);
      if (logsRes.data) setLogs(logsRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const toggleTemplate = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ active: !active })
      .eq("id", id);

    if (error) toast.error("Erro ao atualizar");
    else {
      toast.success("Status atualizado!");
      fetchData();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Automações</h2>
            <p className="text-muted-foreground">Gerencie suas mensagens automáticas do WhatsApp.</p>
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
              {templates.map((tpl) => (
                <Card key={tpl.id} className="flex flex-col bg-white dark:bg-slate-900 border shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                        <MessageSquare size={20} />
                      </div>
                      <Switch 
                        checked={tpl.active} 
                        onCheckedChange={() => toggleTemplate(tpl.id, tpl.active)}
                      />
                    </div>
                    <CardTitle className="text-lg mt-4">{tpl.name}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wider font-mono">
                      {tpl.event_type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-4">
                        "{tpl.content}"
                      </p>
                    </div>
                  </CardContent>
                  <div className="p-4 border-t flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 gap-2">
                      <Settings2 size={14} /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2 text-blue-500 hover:text-blue-600">
                      <Play size={14} /> Testar
                    </Button>
                  </div>
                </Card>
              ))}
              
              <Card className="flex flex-col border-dashed items-center justify-center p-8 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="p-4 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors mb-4">
                  <Plus className="text-slate-400 group-hover:text-slate-600" size={32} />
                </div>
                <p className="font-medium text-slate-500">Novo Modelo</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History size={18} /> Logs de Automação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className={log.status === 'sent' ? 'bg-green-500' : ''}>
                          {log.status}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{log.phone}</p>
                          <p className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono">{log.message_type}</p>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      Nenhum envio registrado.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default AutomationsComponent;
