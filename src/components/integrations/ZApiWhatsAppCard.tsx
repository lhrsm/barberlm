import { useState, useEffect } from "react";
import { 
  Zap, 
  RefreshCw, 
  Trash2, 
  Save, 
  Loader2, 
  Copy, 
  Edit3, 
  ExternalLink, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  History,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface WhatsAppConnection {
  id: string;
  instance_id: string;
  server_url: string;
  instance_token: string;
  status: string;
  webhook_url: string | null;
  updated_at?: string;
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");

  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("config");

  useEffect(() => {
    if (tenantId) {
      fetchConnection();
      fetchLogs();
    }
  }, [tenantId]);

  async function fetchConnection() {
    try {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("barber_id", tenantId) // Standardized to barber_id
        .maybeSingle();

      if (data) {
        setConnection(data as WhatsAppConnection);
        setTempWebhookUrl(data.webhook_url || "");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const { data } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("barber_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (data) setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    
    const instanceId = (formData.get('instance_id') as string).trim();
    const instanceToken = (formData.get('instance_token') as string).trim();
    const apiBaseUrl = (formData.get('api_url') as string || "https://api.z-api.io").trim();

    // Clean API URL
    let cleanApiUrl = apiBaseUrl;
    if (cleanApiUrl.includes('/instances/')) {
      cleanApiUrl = cleanApiUrl.split('/instances/')[0];
    }
    cleanApiUrl = cleanApiUrl.replace(/\/$/, "");

    const webhookUrl = `${window.location.origin}/api/webhooks/zapi/${tenantId}`;

    const upsertData = {
      barbershop_id: tenantId,
      instance_id: instanceId,
      instance_token: instanceToken,
      server_url: cleanApiUrl,
      webhook_url: webhookUrl,
      provider: 'z-api'
    };

    try {
      const { data: saved, error } = connection?.id 
        ? await supabase.from("whatsapp_connections").update(upsertData).eq("id", connection.id).select().single()
        : await supabase.from("whatsapp_connections").insert([upsertData]).select().single();

      if (error) throw error;

      setConnection(saved as WhatsAppConnection);
      setTempWebhookUrl(webhookUrl);
      toast.success("Configurações salvas com sucesso!");
      
      // Auto-configure webhook on Z-API
      await setupWebhook(saved as WhatsAppConnection);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function setupWebhook(conn: WhatsAppConnection) {
    if (!conn.webhook_url) return;
    try {
      await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'set-webhook', 
          connectionId: conn.id,
          data: { webhookUrl: conn.webhook_url }
        }
      });
      toast.success("Webhook configurado na Z-API!");
    } catch (err) {
      console.error("Erro ao configurar webhook", err);
      toast.error("Erro ao configurar webhook na Z-API");
    }
  }

  async function testConnection() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const response = await fetch('/api/zapi/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: connection.instance_id,
          token: connection.instance_token,
          connectionId: connection.id
        })
      });

      const result = await response.json();
      
      if (result.connected) {
        toast.success("WhatsApp conectado!");
      } else {
        console.log("[Z-API Test] Disconnected result:", result);
        toast.error("WhatsApp desconectado.");
      }
      fetchConnection();
    } catch (err: any) {
      toast.error("Erro ao testar conexão");
    } finally {
      setIsTesting(false);
    }
  }
  
  async function sendTestMessage() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const response = await fetch('/api/zapi/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          message: "Olá! Este é um teste de envio real do BarberLM via Z-API. 🚀",
          phone: "5571999999999" // User mentioned this number in example
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("Mensagem de teste enviada!");
      } else {
        toast.error("Erro ao enviar: " + (result.error || "Erro na API"));
      }
    } catch (err) {
      toast.error("Erro ao testar envio");
    } finally {
      setIsTesting(false);
    }
  }


  async function handleDeleteWebhook() {
    if (!connection?.id || !confirm("Deseja realmente excluir este webhook?")) return;
    
    try {
      await supabase
        .from('whatsapp_connections')
        .update({ webhook_url: null })
        .eq('id', connection.id);
      
      setConnection({ ...connection, webhook_url: null });
      setTempWebhookUrl("");
      toast.success("Webhook excluído");
    } catch (err) {
      toast.error("Erro ao excluir webhook");
    }
  }

  async function handleUpdateWebhook() {
    if (!connection?.id) return;
    
    try {
      await supabase
        .from('whatsapp_connections')
        .update({ webhook_url: tempWebhookUrl })
        .eq('id', connection.id);
      
      setConnection({ ...connection, webhook_url: tempWebhookUrl });
      setIsEditingWebhook(false);
      toast.success("Webhook atualizado");
      
      // Also update on Z-API
      await setupWebhook({ ...connection, webhook_url: tempWebhookUrl });
    } catch (err) {
      toast.error("Erro ao atualizar webhook");
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <Card className="bg-[#0b0f1a] border-white/10 animate-pulse">
        <CardContent className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = connection?.status === 'connected';

  return (
    <div className="space-y-6">
      <Card className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
        
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                <Zap className="text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">WhatsApp Z-API</CardTitle>
                <CardDescription className="text-slate-400">Integração oficial sem Client-Token</CardDescription>
              </div>
            </div>
            
            <Badge className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-full border transition-all duration-500",
              isConnected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            )}>
              <span className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                )} />
                {isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
              </span>
            </Badge>
          </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 border-b border-white/5">
            <TabsList className="bg-transparent h-12 gap-6 p-0">
              <TabsTrigger 
                value="config" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-2 h-full text-slate-400 transition-all font-medium"
              >
                Configuração
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-2 h-full text-slate-400 transition-all font-medium"
              >
                Logs de Envio
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="config" className="p-0 m-0">
            <CardContent className="space-y-8 pt-6">
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">ID da Instância</Label>
                <Input 
                  name="instance_id" 
                  defaultValue={connection?.instance_id} 
                  placeholder="EX: 3B..."
                  className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">Token da Instância</Label>
                <Input 
                  name="instance_token" 
                  type="password" 
                  defaultValue={connection?.instance_token} 
                  placeholder="Seu token Z-API"
                  className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">API da Instância (URL Base)</Label>
                <Input 
                  name="api_url" 
                  defaultValue={connection?.server_url || "https://api.z-api.io"} 
                  className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button type="submit" disabled={isSaving} className="flex-1 bg-white text-black hover:bg-slate-200 h-11 font-semibold">
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                Salvar Configurações
              </Button>
              {connection?.id && (
                <>
                  <Button 
                    type="button" 
                    onClick={testConnection} 
                    disabled={isTesting}
                    className="flex-1 bg-white text-black hover:bg-slate-200 h-11 font-semibold"
                  >
                    {isTesting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
                    Testar Status
                  </Button>
                  <Button 
                    type="button" 
                    onClick={sendTestMessage} 
                    disabled={isTesting}
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-11 font-semibold"
                  >
                    {isTesting ? <Loader2 className="animate-spin mr-2" /> : <MessageSquare size={18} className="mr-2" />}
                    Enviar Teste
                  </Button>
                </>
              )}
            </div>
          </form>

          {connection?.id && (
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-blue-400 h-5 w-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Webhook configurado
                  </h3>
                </div>
              </div>

              {connection.webhook_url ? (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    {isEditingWebhook ? (
                      <Input 
                        value={tempWebhookUrl} 
                        onChange={(e) => setTempWebhookUrl(e.target.value)}
                        className="bg-white/5 border-white/10 flex-1"
                      />
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-blue-300 flex-1 truncate max-w-full">
                        {connection.webhook_url}
                      </div>
                    )}
                    
                    <div className="flex gap-2 shrink-0">
                      {isEditingWebhook ? (
                        <>
                          <Button size="sm" onClick={handleUpdateWebhook} className="bg-green-600 hover:bg-green-700">
                            Gravar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditingWebhook(false)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5" onClick={() => copyToClipboard(connection.webhook_url!)}>
                            <Copy size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5" onClick={() => setIsEditingWebhook(true)}>
                            <Edit3 size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400/60 hover:text-red-400 hover:bg-red-400/5" onClick={handleDeleteWebhook}>
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <AlertCircle size={10} />
                    Este endpoint recebe notificações em tempo real da Z-API.
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-6 text-center">
                  <p className="text-sm text-yellow-500/80 mb-4">Clique em "Salvar Configurações" para gerar seu Webhook oficial.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        </TabsContent>
        
        <TabsContent value="logs" className="p-0 m-0">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                  <FileText className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                  <p className="text-slate-400">Nenhum log de automação encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.status === 'success' || log.status === 'received' ? "default" : "destructive"} className={cn("text-[10px] uppercase", (log.status === 'success' || log.status === 'received') && "bg-emerald-500 hover:bg-emerald-600")}>
                            {log.status === 'success' ? "Enviado" : log.status === 'received' ? "Webhook" : "Erro"}
                          </Badge>
                          <span className="text-slate-400 text-xs">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 capitalize">
                          {log.message_type?.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-slate-400">Info: {log.phone || 'N/A'}</p>
                      </div>
                      {log.error_message && (
                        <p className="text-[10px] text-red-400 max-w-xs">{log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
        
        <CardFooter className="bg-white/5 border-t border-white/5 px-6 py-4">
          <div className="flex justify-between items-center w-full">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-slate-500">v2.1.0 - Clean Architecture Integration</p>
            {connection?.updated_at && (
              <p className="text-[10px] text-slate-400">
                Última sincronização: {new Date(connection.updated_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
            <div className="flex gap-4">
              <a href="https://z-api.io" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                Docs Z-API <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
