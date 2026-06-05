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
  webhook_received_url?: string;
  webhook_received_configured_at?: string;
  webhook_received_last_response?: any;
}

const isZApiSuccess = (data: any) => {
  if (!data) return false;
  if (data.success === true) return true;
  if (data.allCompatible === true) return true;
  const result = data.result;
  if (result) {
    if (result.value === true || result.success === true || result.message?.toLowerCase().includes("sucesso")) return true;
    if (Array.isArray(data.results)) {
      return data.results.every((r: any) => r.success || r.isCompatible);
    }
  }
  if (data.status === 200 || data.status === 201) return true;
  return false;
};

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [zapiResponse, setZapiResponse] = useState<any>(null);
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [lastWebhookCall, setLastWebhookCall] = useState<any>(null);
  const [lastReceivedConfig, setLastReceivedConfig] = useState<any>(null);
  const [lastExpandedConfig, setLastExpandedConfig] = useState<any>(null);
  const [lastSentMessageInfo, setLastSentMessageInfo] = useState<{id: string, time: string} | null>(null);
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  const [isConfiguringTemp, setIsConfiguringTemp] = useState(false);
  const [lastTempWebhookResult, setLastTempWebhookResult] = useState<any>(null);
  const [isConfiguringNew, setIsConfiguringNew] = useState(false);
  const [lastNewWebhookResult, setLastNewWebhookResult] = useState<any>(null);
  const [isSendingButtonTest, setIsSendingButtonTest] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [lastEndpointTestResult, setLastEndpointTestResult] = useState<any>(null);
  const [buttonTestMessageId, setButtonTestMessageId] = useState<string | null>(null);
  const [isWaitingForCallback, setIsWaitingForCallback] = useState(false);
  const [webhookDebugLogs, setWebhookDebugLogs] = useState<any[]>([]);
  const [callbackResult, setCallbackResult] = useState<{
    received: boolean;
    time?: string | null;
    buttonId?: string | null;
    phone?: string | null;
    payload?: any;
    error?: string;
  } | null>(null);

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
      const { data: logs } = await supabase
        .from("zapi_integration_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (logs) {
        setIntegrationLogs(logs);
        if (logs.length > 0) {
          setLastCheckTime(logs[0].created_at);
        }
        const lastSent = logs.find(l => l.action === 'send-test-message' && l.status_code === 200);
        if (lastSent && (lastSent.response_payload as any)?.messageId) {
          setLastSentMessageInfo({
            id: (lastSent.response_payload as any).messageId,
            time: lastSent.created_at
          });
        }
      }

      // Fetch webhook debug logs
      const { data: debugLogs } = await supabase
        .from("zapi_webhook_debug")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("received_at", { ascending: false })
        .limit(10);
      
      if (debugLogs) {
        setWebhookDebugLogs(debugLogs);
      }
    } catch (error) {
      console.error("Error fetching integration logs:", error);
    }
  }

  async function sendTestMessage() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    if (!formData.phone) {
      toast.error("Telefone de destino ausente");
      return;
    }
    const phone = formData.phone.replace(/\D/g, "");
    if (!phone.startsWith("55") || phone.length < 12) {
      toast.error("Telefone deve estar no formato 55DDDNUMERO (ex: 5571999999999)");
      return;
    }
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'send-test-message', 
          instanceId: instance.id,
          data: { 
            phone: phone,
            message: "Teste de diagnóstico Z-API. Por favor, responda '1' para testar o webhook." 
          }
        }
      });
      if (error) throw error;
      if (data.success) {
        toast.success("Mensagem de teste enviada!");
        setZapiResponse(data.result);
      } else {
        toast.error("Falha no envio (Z-API)");
      }
      await fetchIntegrationLogs();
    } catch (err: any) {
      toast.error("Erro no teste: " + err.message);
    } finally {
      setIsSendingTest(false);
    }
  }

  async function sendTestButtonWithCallback() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    if (!formData.phone) {
      toast.error("Informe um telefone de destino para o teste");
      return;
    }
    const phone = formData.phone.replace(/\D/g, "");
    setIsSendingButtonTest(true);
    setIsWaitingForCallback(true);
    setCallbackResult(null);
    setButtonTestMessageId(null);
    try {
      toast.info("Enviando mensagem com botão...");
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'send-test-button', 
          instanceId: instance.id,
          data: { phone }
        }
      });
      if (error) throw error;
      if (data.success) {
        setButtonTestMessageId(data.result?.messageId);
        toast.success("Mensagem enviada! Clique no botão no seu WhatsApp.");
        
        // Poll for 30 seconds
        let secondsPassed = 0;
        const maxSeconds = 30;
        const startTime = new Date().toISOString();
        
        const checkInterval = setInterval(async () => {
          secondsPassed += 3;
          
          // Refresh logs
          await fetchIntegrationLogs();
          
          const { data: webhookLogs } = await supabase
            .from("zapi_webhook_debug")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("source", "zapi_real")
            .eq("option_id", "main_confirm")
            .gte("received_at", startTime)
            .order("received_at", { ascending: false })
            .limit(1);

          if (webhookLogs && webhookLogs.length > 0) {
            clearInterval(checkInterval);
            setIsWaitingForCallback(false);
            const log = webhookLogs[0];
            setCallbackResult({
              received: true,
              time: log.received_at,
              buttonId: log.option_id,
              phone: log.phone_normalized,
              payload: log.payload_raw
            });
            toast.success("Callback recebido com sucesso!");
          } else if (secondsPassed >= maxSeconds) {
            clearInterval(checkInterval);
            setIsWaitingForCallback(false);
            setCallbackResult({ 
              received: false,
              error: "Nenhum webhook recebido da Z-API após 30 segundos. Verifique se clicou no botão correto."
            });
            toast.error("Tempo esgotado: Callback não recebido.");
          }
        }, 3000);
      } else {
        setIsWaitingForCallback(false);
        toast.error("Erro ao enviar botão: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      setIsWaitingForCallback(false);
      toast.error("Erro: " + err.message);
    } finally {
      setIsSendingButtonTest(false);
    }
  }

  async function checkWebhookDebug() {
    try {
      const { data } = await supabase
        .from("zapi_webhook_debug")
        .select("id")
        .eq("source", "zapi_real")
        .gte("created_at", new Date(Date.now() - 300000).toISOString())
        .limit(1);
      if (!data || data.length === 0) {
        toast.error("A Z-API não está entregando callbacks.", { duration: 10000 });
      } else {
        toast.success("Webhook real detectado!");
      }
    } catch (err) { console.error(err); }
  }

  async function runExpandedWebhookTest() {
    if (!instance?.id) return;
    setIsConfiguring(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { action: 'update-every-webhooks', instanceId: instance.id, data: { webhookUrl, notifySentByMe: true } }
      });
      if (res2.error) throw res2.error;
      setLastWebhookCall(res2.data);
      if (isZApiSuccess(res2.data)) toast.success("Webhooks ampliados configurados!");
      await fetchInstance();
    } catch (err: any) { toast.error("Erro no teste ampliado"); }
    finally { setIsConfiguring(false); }
  }

  async function fetchInstance() {
    try {
      const { data } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
      if (data) {
        setInstance(data as any);
        setFormData({
          instance_id: data.instance_id || "",
          instance_token: data.token || "",
          client_token: data.client_token || "",
          api_url: data.server_url || "https://api.z-api.io",
          phone: data.phone || ""
        });
        if (data.webhook_received_last_response) setLastWebhookCall({ result: data.webhook_received_last_response });
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }

  async function fetchLogs() {
    try {
      const { data } = await supabase.from("automation_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
      if (data) setLogs(data);
    } catch (error) { console.error(error); }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const phone = formData.phone.replace(/\D/g, "");
    const upsertData = {
      tenant_id: tenantId,
      barber_id: tenantId,
      instance_id: formData.instance_id.trim(),
      token: formData.instance_token.trim(),
      client_token: formData.client_token.trim(),
      server_url: formData.api_url.trim(),
      phone,
      provider: 'z-api',
      updated_at: new Date().toISOString()
    };
    try {
      const { data: saved, error } = instance?.id 
        ? await supabase.from("whatsapp_instances").update(upsertData).eq("id", instance.id).select().single()
        : await supabase.from("whatsapp_instances").insert([upsertData]).select().single();
      if (error) throw error;
      setInstance(saved as any);
      toast.success("Salvo!");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      await supabase.functions.invoke('zapi-api', { body: { action: 'set-webhook', instanceId: saved.id, data: { webhookUrl } } });
      await fetchInstance();
    } catch (err: any) { toast.error("Erro ao salvar"); }
    finally { setIsSaving(false); }
  }

  async function syncStatus() {
    if (!instance?.id) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', { body: { action: 'check-status', instanceId: instance.id } });
      if (error) throw error;
      toast.success("Sincronizado!");
      await fetchInstance();
    } catch (err) { toast.error("Erro"); }
    finally { setIsTesting(false); }
  }

  async function reconfigureWebhook() {
    if (!instance?.id) return;
    setIsConfiguring(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      // Usando a URL específica para processamento JSON que não depende de tenant_id no path
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-receive-json`;
      
      const { data, error } = await supabase.functions.invoke('zapi-api', { 
        body: { 
          action: 'update-webhook-received', 
          instanceId: instance.id, 
          data: { webhookUrl } 
        } 
      });
      
      if (error) throw error;
      setLastWebhookCall(data);
      if (isZApiSuccess(data)) {
        toast.success("Webhook Received configurado com sucesso!");
      } else {
        toast.error("Falha na configuração do webhook");
      }
      await fetchInstance();
    } catch (err: any) { 
      toast.error("Erro na reconfiguração: " + err.message); 
    } finally { 
      setIsConfiguring(false); 
    }
  }

  async function testSupabaseEndpoint() {
    if (!instance?.id) return;
    setIsTestingEndpoint(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: {
          action: 'test-received-callback',
          instanceId: instance.id,
          data: {
            phone: formData.phone || "5571988939385",
            text: "1",
            messageId: `test-manual-${Date.now()}`
          }
        }
      });
      if (error) throw error;
      setLastEndpointTestResult(data);
      if (data.success) {
        toast.success("Teste de endpoint enviado com sucesso!");
        await fetchIntegrationLogs();
      } else {
        toast.error("Falha no teste de endpoint");
      }
    } catch (err: any) {
      toast.error("Erro no teste: " + err.message);
    } finally {
      setIsTestingEndpoint(false);
    }
  }

  async function applyTempWebhook(action: 'update-webhook-received' | 'update-every-webhooks') {
    if (!instance?.id) return;
    setIsConfiguringTemp(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action, instanceId: instance.id, data: { webhookUrl: tempWebhookUrl, notifySentByMe: true } }
      });
      if (error) throw error;
      setLastTempWebhookResult({ ...data, timestamp: new Date().toISOString(), webhookApplied: tempWebhookUrl });
      if (isZApiSuccess(data)) toast.success("Aplicado!");
    } catch (err) { toast.error("Erro"); }
    finally { setIsConfiguringTemp(false); }
  }

  async function configureNewZApiUrl() {
    if (!instance?.id) return;
    setIsConfiguringNew(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const newWebhookUrl = `${supabaseUrl}/functions/v1/zapi-receive-json`;
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { action: 'update-every-webhooks', instanceId: instance.id, data: { webhookUrl: newWebhookUrl, notifySentByMe: true } }
      });
      if (res2.error) throw res2.error;
      setLastNewWebhookResult({ ...res2.data, timestamp: new Date().toISOString(), webhookApplied: newWebhookUrl });
      if (isZApiSuccess(res2.data)) toast.success("Nova URL configurada!");
    } catch (err) { toast.error("Erro"); }
    finally { setIsConfiguringNew(false); }
  }

  async function restoreSaasWebhook() {
    if (!instance?.id) return;
    setIsConfiguringTemp(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { action: 'update-every-webhooks', instanceId: instance.id, data: { webhookUrl, notifySentByMe: true } }
      });
      if (res2.error) throw res2.error;
      if (isZApiSuccess(res2.data)) toast.success("Restaurado!");
    } catch (err) { toast.error("Erro"); }
    finally { setIsConfiguringTemp(false); }
  }

  const maskTokenDisplay = (token: string | null | undefined) => {
    if (!token) return "---";
    if (token.length <= 8) return "********";
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <Card className="bg-[#0b0f1a] border-white/10 text-white">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-blue-400" />
            Z-API WhatsApp
          </CardTitle>
          <Badge className={instance?.connected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
            {instance?.connected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="config" className="space-y-4 pt-4">
            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-white/5 border-white/10" placeholder="5571999999999" />
                </div>
                <div className="space-y-2">
                  <Label>ID Instância</Label>
                  <Input value={formData.instance_id} onChange={e => setFormData({...formData, instance_id: e.target.value})} className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Input type="password" value={formData.instance_token} onChange={e => setFormData({...formData, instance_token: e.target.value})} className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Client Token</Label>
                  <Input type="password" value={formData.client_token} onChange={e => setFormData({...formData, client_token: e.target.value})} className="bg-white/5 border-white/10" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />} Salvar
                </Button>
                <Button type="button" variant="outline" onClick={syncStatus} disabled={isTesting}>
                  <RefreshCw className={cn("mr-2", isTesting && "animate-spin")} size={16} /> Sincronizar
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="logs" className="pt-4 space-y-4">
             <div className="space-y-2">
               {logs.map((log, i) => (
                 <div key={i} className="text-xs p-2 border border-white/5 rounded bg-black/20 flex justify-between">
                   <span>{log.event_name} - {log.status}</span>
                   <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                 </div>
               ))}
               {logs.length === 0 && <p className="text-center text-slate-500 py-4">Nenhum log encontrado</p>}
             </div>
          </TabsContent>

          <TabsContent value="diagnostico" className="pt-4 space-y-6">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2"><Activity size={16} className="text-blue-400" /> Diagnóstico do Webhook</h3>
                  <p className="text-[10px] text-slate-400">Verifique se a Z-API está enviando os eventos corretamente</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={reconfigureWebhook} disabled={isConfiguring || !instance} size="sm" className="bg-blue-600 text-[10px] h-8">
                    {isConfiguring ? <Loader2 className="animate-spin mr-1" size={12} /> : <RefreshCw className="mr-1" size={12} />} Sincronizar Webhook Received
                  </Button>
                  <Button onClick={testSupabaseEndpoint} disabled={isTestingEndpoint || !instance} size="sm" className="bg-amber-600 text-[10px] h-8">
                    {isTestingEndpoint ? <Loader2 className="animate-spin mr-1" size={12} /> : <Terminal className="mr-1" size={12} />} Testar Endpoint Supabase
                  </Button>
                  <Button onClick={sendTestButtonWithCallback} disabled={isSendingButtonTest || isWaitingForCallback || !instance} size="sm" className="bg-purple-600 text-[10px] h-8">
                    {isSendingButtonTest || isWaitingForCallback ? <Loader2 className="animate-spin mr-1" size={12} /> : <Send className="mr-1" size={12} />} Testar WhatsApp Real
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                <div className="space-y-1">
                  <p className="text-slate-500">Instance ID</p>
                  <p className="font-mono text-slate-300">{instance?.instance_id || "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Telefone Conectado</p>
                  <p className="font-mono text-slate-300">{instance?.phone || "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Token (Mascarado)</p>
                  <p className="font-mono text-slate-300">{maskTokenDisplay(instance?.token)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Client Token (Mascarado)</p>
                  <p className="font-mono text-slate-300">{maskTokenDisplay(instance?.client_token)}</p>
                </div>
                <div className="col-span-full space-y-1 border-t border-white/5 pt-2">
                  <p className="text-slate-500">URL Configurada no Sistema</p>
                  <p className="font-mono text-blue-400 break-all">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-receive-json`}</p>
                </div>
                <div className="col-span-full space-y-1">
                  <p className="text-slate-500">URL Atual na Z-API (Received)</p>
                  <p className="font-mono text-emerald-400 break-all">{instance?.webhook_received_url || "Não configurado"}</p>
                </div>
              </div>
            </div>

            {callbackResult && (
              <div className={cn("p-4 rounded-xl border space-y-3", callbackResult.received ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                <div className="flex items-center justify-between">
                  <h3 className={cn("text-sm font-bold", callbackResult.received ? "text-emerald-400" : "text-red-400")}>
                    {callbackResult.received ? "✅ Webhook Recebido!" : "❌ Falha no Recebimento"}
                  </h3>
                  {callbackResult.time && <span className="text-[10px] text-slate-500">{new Date(callbackResult.time).toLocaleTimeString()}</span>}
                </div>
                {callbackResult.received ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-300">Botão detectado: <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{callbackResult.buttonId}</Badge></p>
                    <pre className="bg-black/40 p-2 rounded border border-white/5 font-mono overflow-auto max-h-32 text-[9px]">
                      {JSON.stringify(callbackResult.payload, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-[10px] text-red-400 italic">{callbackResult.error || "Aguardando clique no WhatsApp..."}</p>
                )}
              </div>
            )}

            {lastEndpointTestResult && (
              <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-amber-400">Resultado do Teste de Endpoint</h3>
                    <p className="text-[10px] text-slate-400">Simulação manual de ReceivedCallback</p>
                  </div>
                  <Badge className={lastEndpointTestResult.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                    {lastEndpointTestResult.success ? "Sucesso" : "Falha"}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <p className="text-[9px] text-slate-400">URL Chamada: <span className="text-blue-400 font-mono">{lastEndpointTestResult.webhookUrl}</span></p>
                  <pre className="text-[8px] bg-black/40 p-2 rounded border border-white/5 font-mono overflow-auto max-h-32 text-slate-300">
                    {JSON.stringify(lastEndpointTestResult.result, null, 2)}
                  </pre>
                </div>
                
                <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[9px] text-amber-300">
                  <p>ℹ️ Se o status for "Sucesso", verifique se um novo registro apareceu em "Webhooks Recebidos" abaixo.</p>
                </div>

            {lastWebhookCall && (
              <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-blue-400">Status da Última Sincronização</h3>
                    <p className="text-[10px] text-slate-400">{instance?.webhook_received_configured_at ? new Date(instance.webhook_received_configured_at).toLocaleString() : "Data desconhecida"}</p>
                  </div>
                  <Badge className={isZApiSuccess(lastWebhookCall) ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                    {isZApiSuccess(lastWebhookCall) ? "Configurado" : "Erro"}
                  </Badge>
                </div>
                
                {lastWebhookCall.results && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lastWebhookCall.results.map((r: any) => (
                      <div key={r.type} className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                        <span className="text-[9px] text-slate-300 truncate max-w-[150px]">{r.type.replace('update-webhook-', '')}</span>
                        <div className="flex items-center gap-1">
                          {r.success ? (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          ) : r.isCompatible ? (
                            <ShieldCheck size={12} className="text-blue-400" />
                          ) : (
                            <AlertCircle size={12} className="text-red-500" />
                          )}
                          <span className={cn("text-[8px] font-bold", r.success ? "text-emerald-500" : r.isCompatible ? "text-blue-400" : "text-red-500")}>
                            {r.success ? "OK" : r.isCompatible ? "N/A" : "Erro"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded text-[9px] text-blue-300">
                  <p>ℹ️ Esta versão da Z-API processa botões via <strong>ReceivedCallback</strong> dentro do webhook principal.</p>
                </div>
                
                <details className="text-[9px]">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-300">Ver Resposta Completa da API</summary>
                  <pre className="mt-2 text-[8px] bg-black/40 p-2 rounded border border-white/5 font-mono overflow-auto max-h-48 text-slate-300">
                    {JSON.stringify(lastWebhookCall, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2"><History size={16} className="text-emerald-400" /> Webhooks Recebidos (Raw)</h3>
                <Button variant="ghost" size="sm" onClick={fetchIntegrationLogs} className="h-6 text-[10px]">Atualizar</Button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-auto border border-white/5 rounded-lg p-2 bg-black/20">
                {webhookDebugLogs.length > 0 ? (
                  webhookDebugLogs.map((log) => (
                    <div key={log.id} className="bg-black/30 border-b border-white/5 last:border-0 p-2 text-[9px] space-y-1">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className={cn("text-[8px] h-4", log.option_id ? "text-purple-400 border-purple-500/30" : "text-slate-400")}>
                          {log.payload_raw?.type || "Unknown"}
                        </Badge>
                        <span className="text-slate-500 font-mono">{new Date(log.received_at).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex gap-2 text-slate-400">
                        <span className="font-bold">De: {log.phone_normalized || "Sistema"}</span>
                        {log.option_id && <span className="text-emerald-400 font-bold">Botão: {log.option_id}</span>}
                      </div>
                      <details>
                        <summary className="text-[8px] text-slate-600 cursor-pointer">Payload</summary>
                        <pre className="mt-1 p-1 bg-black/50 rounded text-slate-500 font-mono text-[8px] overflow-auto max-h-24">
                          {JSON.stringify(log.payload_raw, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-[10px]">Nenhum webhook recebido ainda.</p>
                    <p className="text-[8px]">Envie uma mensagem para o WhatsApp conectado e verifique se aparece aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
