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
  FileText,
  Phone,
  Activity,
  Terminal,
  Send
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

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  server_url: string;
  token: string;
  client_token?: string;
  status: string;
  webhook_url: string | null;
  phone?: string;
  updated_at?: string;
  connected?: boolean;
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [zapiResponse, setZapiResponse] = useState<any>(null);
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    instance_id: "",
    instance_token: "",
    client_token: "",
    api_url: "https://api.z-api.io",
    phone: ""
  });

  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("config");

  useEffect(() => {
    if (tenantId) {
      fetchInstance();
      fetchLogs();
      fetchIntegrationLogs();
    }
  }, [tenantId]);

  async function fetchIntegrationLogs() {
    try {
      const { data } = await supabase
        .from("zapi_integration_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (data) {
        setIntegrationLogs(data);
        if (data.length > 0) {
          setLastCheckTime(data[0].created_at);
        }
      }
    } catch (error) {
      console.error("Error fetching integration logs:", error);
    }
  }

  async function sendTestMessage() {
    if (!instance?.id || !formData.phone) {
      toast.error("Configure a instância e o telefone primeiro");
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'send-test-message', 
          instanceId: instance.id,
          data: { 
            phone: formData.phone.replace(/\D/g, ""),
            message: "Teste de diagnóstico Z-API. Por favor, responda '1' para testar o webhook." 
          }
        }
      });

      if (error) throw error;
      
      if (data.result?.sent) {
        toast.success("Mensagem de teste enviada!");
        setZapiResponse(data.result);
        
        // Check if debug log appears after a delay
        setTimeout(() => {
          checkWebhookDebug();
        }, 5000);
      } else {
        toast.error("Erro ao enviar: " + (data.result?.message || "Erro desconhecido"));
      }
    } catch (err: any) {
      toast.error("Erro no teste: " + err.message);
    } finally {
      setIsSendingTest(false);
    }
  }

  async function checkWebhookDebug() {
    try {
      const { data } = await supabase
        .from("zapi_webhook_debug")
        .select("id")
        .eq("source", "zapi_real")
        .gte("created_at", new Date(Date.now() - 60000).toISOString())
        .limit(1);

      if (!data || data.length === 0) {
        toast.warning("A instância envia mensagens, mas não está disparando webhook Ao Receber. Verifique no painel da Z-API se o webhook de mensagens recebidas está habilitado nessa mesma instância.", {
          duration: 10000,
        });
      } else {
        toast.success("Webhook real detectado com sucesso!");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchInstance() {
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (data) {
        setInstance(data as any);
        setFormData({
          instance_id: data.instance_id || "",
          instance_token: data.token || "",
          client_token: data.client_token || "",
          api_url: data.server_url || "https://api.z-api.io",
          phone: data.phone || ""
        });
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
    
    const phone = formData.phone.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      toast.error("Telefone inválido");
      setIsSaving(false);
      return;
    }

    const upsertData = {
      tenant_id: tenantId,
      barber_id: tenantId,
      instance_id: formData.instance_id.trim(),
      token: formData.instance_token.trim(),
      client_token: formData.client_token.trim(),
      server_url: formData.api_url.trim() || "https://api.z-api.io",
      phone: phone,
      provider: 'z-api',
      status: instance?.status || 'disconnected',
      updated_at: new Date().toISOString()
    };

    try {
      const { data: saved, error } = instance?.id 
        ? await supabase.from("whatsapp_instances").update(upsertData).eq("id", instance.id).select().single()
        : await supabase.from("whatsapp_instances").insert([upsertData]).select().single();

      if (error) throw error;

      setInstance(saved as any);
      toast.success("Configurações salvas!");
      
      // Auto setup webhook
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      
      await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'set-webhook', 
          instanceId: saved.id,
          data: { webhookUrl }
        }
      });
      
      await fetchInstance();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function syncStatus() {
    if (!instance?.id) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'check-status', instanceId: instance.id }
      });
      if (error) throw error;
      toast.success(`Sincronizado! Status: ${data.connected ? 'Conectado' : 'Desconectado'}`);
      await fetchInstance();
    } catch (err: any) {
      toast.error("Erro na sincronização");
    } finally {
      setIsTesting(false);
    }
  }

  async function reconfigureWebhook() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    
    setIsConfiguring(true);
    setZapiResponse(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-webhook-received', 
          instanceId: instance.id,
          data: { webhookUrl }
        }
      });
      
      if (error) throw error;
      
      setZapiResponse(data.result);
      toast.success("Webhook reconfigurado com sucesso!");
      
      // Fetch current config after update
      await fetchWebhookConfig();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao configurar: " + err.message);
    } finally {
      setIsConfiguring(false);
    }
  }

  async function fetchWebhookConfig() {
    if (!instance?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'get-webhooks', 
          instanceId: instance.id
        }
      });
      
      if (error) throw error;
      if (data.success) {
        setWebhookConfig(data.result);
      }
    } catch (err) {
      console.error("Erro ao buscar config de webhook:", err);
    }
  }

  useEffect(() => {
    if (instance?.id) {
      fetchWebhookConfig();
    }
  }, [instance?.id]);

  const maskToken = (token: string) => {
    if (!token) return "Não configurado";
    if (token.length <= 8) return "********";
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  const isConnected = instance?.connected;

  return (
    <Card className="bg-[#0b0f1a] border-white/10 text-white">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-blue-400" />
            Z-API WhatsApp
          </CardTitle>
          <Badge className={isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="config" className="space-y-4 pt-4">
            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="bg-white/5 border-white/10"
                    placeholder="5571999999999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID da Instância</Label>
                  <Input 
                    value={formData.instance_id}
                    onChange={e => setFormData({...formData, instance_id: e.target.value})}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Input 
                    type="password"
                    value={formData.instance_token}
                    onChange={e => setFormData({...formData, instance_token: e.target.value})}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Token</Label>
                  <Input 
                    type="password"
                    value={formData.client_token}
                    onChange={e => setFormData({...formData, client_token: e.target.value})}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                  Salvar
                </Button>
                <Button type="button" variant="outline" onClick={syncStatus} disabled={isTesting}>
                  <RefreshCw className={cn("mr-2", isTesting && "animate-spin")} size={16} />
                  Sincronizar
                </Button>
              </div>
            </form>

            <div className="pt-6 space-y-4 border-t border-white/10">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-blue-400 font-bold flex items-center gap-2">
                    <ShieldCheck size={16} /> URL do Webhook
                  </Label>
                  <p className="text-xs text-slate-400">
                    Copie a URL abaixo e cadastre no painel da Z-API (Webhook de Mensagens Recebidas).
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook/${tenantId}`}
                      className="bg-black/40 border-white/10 text-[10px] font-mono flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook/${tenantId}`;
                        navigator.clipboard.writeText(url);
                        toast.success("URL copiada!");
                      }}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Configuração Atual na Z-API</h4>
                    <Button 
                      onClick={reconfigureWebhook} 
                      disabled={isConfiguring || !instance}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      {isConfiguring ? <Loader2 className="animate-spin mr-2" size={14} /> : <RefreshCw className="mr-2" size={14} />}
                      Reconfigurar Webhook "Ao Receber"
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Instance ID</p>
                      <p className="font-mono">{instance?.instance_id || "---"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Status da Instância</p>
                      <Badge variant="outline" className={cn("text-[10px]", isConnected ? "text-emerald-400 border-emerald-400/20" : "text-red-400 border-red-400/20")}>
                        {isConnected ? "Conectada" : "Desconectada"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Token (Mascarado)</p>
                      <p className="font-mono">{maskToken(instance?.token || "")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Client Token (Mascarado)</p>
                      <p className="font-mono">{maskToken(instance?.client_token || "")}</p>
                    </div>
                  </div>

                  {webhookConfig && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Webhook Configurado (Mensagens Recebidas)</p>
                      <div className="bg-black/30 p-2 rounded font-mono text-[10px] break-all border border-white/5">
                        {webhookConfig.webhookReceived || "Nenhum configurado"}
                      </div>
                    </div>
                  )}

                  {zapiResponse && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-amber-400 uppercase text-[10px] font-bold">Última Resposta da API</p>
                      <pre className="bg-black/30 p-2 rounded font-mono text-[10px] overflow-auto max-h-32 text-slate-300 border border-white/5">
                        {JSON.stringify(zapiResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">Próximos Passos</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                  <li>Após clicar em reconfigurar, envie uma mensagem real pelo WhatsApp para o número acima.</li>
                  <li>Use o botão <strong>Ver Debug de Webhook</strong> para confirmar que a mensagem chegou.</li>
                  <li>O registro deve aparecer com a origem <strong>"zapi_real"</strong>.</li>
                </ul>
                <Button 
                  variant="outline" 
                  className="w-full text-xs h-8 border-blue-500/30 hover:bg-blue-500/20"
                  asChild
                >
                  <a href="/automations">Ver Debug de Webhook</a>
                </Button>
              </div>
            </div>

          </TabsContent>
          
          <TabsContent value="logs" className="pt-4">
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="text-xs p-2 border border-white/5 rounded bg-black/20 flex justify-between">
                  <span>{log.message_type} - {log.phone}</span>
                  <span className={log.status === 'sent' ? "text-emerald-400" : "text-red-400"}>{log.status}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-center text-slate-500 py-4">Nenhum log encontrado</p>}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
