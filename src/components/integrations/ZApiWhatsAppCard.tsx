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
  // Check top level success
  if (data.success === true) return true;
  // Check result object
  const result = data.result;
  if (result) {
    // Some Z-API endpoints return value: true on success
    // Others might just return a success message or the updated object
    if (result.value === true || result.success === true || result.message?.toLowerCase().includes("sucesso")) return true;
    
    // If it's the set-webhook call, check individual results
    if (Array.isArray(data.results)) {
      return data.results.every((r: any) => r.success);
    }
  }
  // Check HTTP status if available - Z-API returns 200 or 201 for most successes
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
  const [buttonTestMessageId, setButtonTestMessageId] = useState<string | null>(null);


  
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

        const lastSent = data.find(l => l.action === 'send-test-message' && l.status_code === 200);
        if (lastSent && (lastSent.response_payload as any)?.messageId) {
          setLastSentMessageInfo({
            id: (lastSent.response_payload as any).messageId,
            time: lastSent.created_at
          });
        }


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

    if (!formData.instance_id) {
      toast.error("ID da instância ausente");
      return;
    }

    if (!formData.instance_token) {
      toast.error("Token ausente");
      return;
    }

    if (!formData.client_token) {
      toast.error("Client Token ausente");
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

      if (error) {
        console.error("Function error:", error);
        toast.error(`Erro na Edge Function: ${error.message || "Erro desconhecido"}`);
        await fetchIntegrationLogs();
        return;
      }
      
      if (data.success) {
        toast.success("Mensagem de teste enviada!");
        setZapiResponse(data.result);
        
        if (data.result?.messageId) {
          setLastSentMessageInfo({
            id: data.result.messageId,
            time: new Date().toISOString()
          });
        }

        
        setTimeout(() => {
          checkWebhookDebug();
        }, 5000);
      } else {
        // Report detailed error from Z-API
        const errorMsg = data.error || data.result?.message || "Erro desconhecido";
        const status = data.status || "N/A";
        const endpoint = data.endpoint || "N/A";
        
        setZapiResponse(data.result || { error: errorMsg, status, endpoint });
        
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">Falha no envio (Z-API)</span>
            <span className="text-[10px] opacity-80">Status: {status}</span>
            <span className="text-[10px] opacity-80">Erro: {errorMsg}</span>
            <span className="text-[10px] opacity-80 truncate">URL: {endpoint}</span>
          </div>,
          { duration: 8000 }
        );
      }
      
      await fetchIntegrationLogs();
    } catch (err: any) {
      console.error("Catch error:", err);
      toast.error("Erro no teste: " + err.message);
    } finally {
      setIsSendingTest(false);
    }
  }

  async function sendTestButtonMessage() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }

    if (!formData.phone) {
      toast.error("Telefone de destino ausente");
      return;
    }

    const phone = formData.phone.replace(/\D/g, "");
    setIsSendingButtonTest(true);
    setButtonTestMessageId(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'send-test-button', 
          instanceId: instance.id,
          data: { phone }
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("Mensagem com botão enviada!");
        if (data.result?.messageId) {
          setButtonTestMessageId(data.result.messageId);
        }
        
        // Iniciar polling para ver se o webhook de resposta chega
        toast.info("Aguardando clique no botão... (5 min)", { duration: 10000 });
        
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const { data: webhookLogs } = await supabase
            .from("zapi_webhook_debug")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("option_id", "main_confirm")
            .gte("created_at", new Date(Date.now() - 300000).toISOString())
            .order("created_at", { ascending: false })
            .limit(1);

          if (webhookLogs && webhookLogs.length > 0) {
            clearInterval(interval);
            toast.success("WEBHOOK RECEBIDO! O clique no botão foi detectado com sucesso.", { duration: 10000 });
            setZapiResponse(webhookLogs[0]);
          }

          if (attempts > 30) { // 5 minutos aprox
            clearInterval(interval);
          }
        }, 10000);
      } else {
        toast.error("Erro ao enviar botão: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
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
        .gte("created_at", new Date(Date.now() - 300000).toISOString()) // Increased to 5 minutes
        .limit(1);

      if (!data || data.length === 0) {
        toast.error(
          <div className="flex flex-col gap-2">
            <span className="font-bold">Falha Crítica no Webhook</span>
            <p className="text-xs">
              A Z-API aceitou a URL, mas não está entregando callbacks. Verifique no painel da Z-API se a instância está conectada, se o webhook está habilitado no evento correto ou acione o suporte da Z-API informando instanceId, messageId e horário do teste.
            </p>
          </div>,
          { duration: 15000 }
        );
      } else {
        toast.success("Webhook real detectado com sucesso!");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function runExpandedWebhookTest() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    
    setIsConfiguring(true);
    setZapiResponse(null);
    setLastWebhookCall(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      
      toast.info("Iniciando teste ampliado de webhooks...");

      // 1. Chamar update-notify-sent-by-me
      const res1 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-notify-sent-by-me', 
          instanceId: instance.id,
          data: { notifySentByMe: true }
        }
      });
      
      if (res1.error) throw new Error("Erro em update-notify-sent-by-me: " + res1.error.message);
      
      // 2. Chamar update-every-webhooks
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-every-webhooks', 
          instanceId: instance.id,
          data: { 
            webhookUrl: webhookUrl,
            notifySentByMe: true 
          }
        }
      });
      
      if (res2.error) throw new Error("Erro em update-every-webhooks: " + res2.error.message);
      
      setLastWebhookCall(res2.data);
      setLastExpandedConfig(res2.data);
      setZapiResponse(res2.data.result);

      
      if (res2.data.success && res2.data.result?.value === true) {
        toast.success("Webhooks ampliados configurados! Enviando mensagem teste...");
        // Enviar mensagem teste após configurar
        await sendTestMessage();
      } else {
        toast.error("Z-API recusou a configuração ampliada");
      }
      
      await fetchIntegrationLogs();
      await fetchInstance();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro no teste ampliado: " + err.message);
    } finally {
      setIsConfiguring(false);
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
        .eq("tenant_id", tenantId)
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
    setLastWebhookCall(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'set-webhook', 
          instanceId: instance.id,
          data: { webhookUrl }
        }
      });
      
      if (error) throw error;
      
      setLastWebhookCall(data);
      setLastReceivedConfig(data);
      setZapiResponse(data.result);

      
      if (data.success && data.result?.value === true) {
        toast.success("Webhook Ao Receber configurado com sucesso.");
      } else {
        const errorMsg = data.result?.message || (data.result?.value !== true ? "Z-API não retornou value: true" : "Verifique os logs");
        toast.error("Falha na configuração: " + errorMsg);
      }
      
      await fetchIntegrationLogs();
      await fetchInstance();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao configurar: " + err.message);
    } finally {
      setIsConfiguring(false);
    }
  }

  async function applyTempWebhook(action: 'update-webhook-received' | 'update-every-webhooks') {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    
    if (!tempWebhookUrl.startsWith("http")) {
      toast.error("URL temporária inválida");
      return;
    }

    setIsConfiguringTemp(true);
    setLastTempWebhookResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action, 
          instanceId: instance.id,
          data: { 
            webhookUrl: tempWebhookUrl,
            notifySentByMe: true // Usado para update-every-webhooks
          }
        }
      });
      
      if (error) throw error;
      
      setLastTempWebhookResult({
        ...data,
        timestamp: new Date().toISOString(),
        webhookApplied: tempWebhookUrl
      });
      
      if (data.success && data.result?.value === true) {
        toast.success(`Webhook temporário aplicado via ${action}`);
      } else {
        toast.error("Z-API recusou a configuração temporária");
      }
      
      await fetchIntegrationLogs();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao configurar: " + err.message);
    } finally {
      setIsConfiguringTemp(false);
    }
  }

  
  async function configureNewZApiUrl() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    
    setIsConfiguringNew(true);
    setLastNewWebhookResult(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const newWebhookUrl = `${supabaseUrl}/functions/v1/zapi-receive-json`;
      
      toast.info("Configurando nova URL pública na Z-API...");

      // 1. update-webhook-received
      const res1 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-webhook-received', 
          instanceId: instance.id,
          data: { webhookUrl: newWebhookUrl }
        }
      });
      
      if (res1.error) throw new Error("Erro ao configurar Ao Receber: " + res1.error.message);

      // 2. update-every-webhooks
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-every-webhooks', 
          instanceId: instance.id,
          data: { 
            webhookUrl: newWebhookUrl,
            notifySentByMe: true 
          }
        }
      });
      
      if (res2.error) throw new Error("Erro ao configurar Todos os Webhooks: " + res2.error.message);

      setLastNewWebhookResult({
        ...res2.data,
        timestamp: new Date().toISOString(),
        webhookApplied: newWebhookUrl
      });
      
      if (res2.data.success && res2.data.result?.value === true) {
        toast.success("Nova URL configurada com sucesso em todos os eventos!");
      } else {
        toast.error("Falha ao configurar nova URL na Z-API");
      }
      
      await fetchIntegrationLogs();
      await fetchInstance();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro na configuração: " + err.message);
    } finally {
      setIsConfiguringNew(false);
    }

  }

  async function restoreSaasWebhook() {
    if (!instance?.id) {
      toast.error("Salve as configurações primeiro");
      return;
    }
    
    setIsConfiguringTemp(true);
    setLastTempWebhookResult(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
      
      toast.info("Restaurando webhooks do SaaS...");

      // 1. update-webhook-received
      const res1 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-webhook-received', 
          instanceId: instance.id,
          data: { webhookUrl }
        }
      });
      
      if (res1.error) throw new Error("Erro ao restaurar Ao Receber: " + res1.error.message);

      // 2. update-every-webhooks
      const res2 = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'update-every-webhooks', 
          instanceId: instance.id,
          data: { 
            webhookUrl,
            notifySentByMe: true 
          }
        }
      });
      
      if (res2.error) throw new Error("Erro ao restaurar Todos os Webhooks: " + res2.error.message);

      setLastTempWebhookResult({
        ...res2.data,
        timestamp: new Date().toISOString(),
        webhookApplied: webhookUrl
      });
      
      if (res2.data.success && res2.data.result?.value === true) {
        toast.success("Webhooks do SaaS restaurados com sucesso!");
      } else {
        toast.error("Falha ao restaurar webhooks do SaaS");
      }
      
      await fetchIntegrationLogs();
      await fetchInstance();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao restaurar: " + err.message);
    } finally {
      setIsConfiguringTemp(false);
    }
  }

  useEffect(() => {
    // Initial fetch logs and integration logs already called in another useEffect
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
            <TabsTrigger value="logs">Logs Automação</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico Z-API</TabsTrigger>
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
                    <ShieldCheck size={16} /> URL do Webhook (Copiar para Z-API)
                  </Label>
                  <p className="text-xs text-slate-400">
                    Esta URL deve estar configurada no painel da Z-API em <strong>Webhooks → Ao receber</strong>.
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
                      className="shrink-0"
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
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Terminal size={14} className="text-blue-400" />
                      Dados da Integração
                    </h4>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          const testPayload = {
                            type: "ListResponseCallback",
                            phone: formData.phone || "5571996242196",
                            selectedRowId: "main_confirm",
                            text: "Confirmar agendamento",
                            instanceId: instance?.instance_id
                          };
                          
                          toast.promise(
                            supabase.functions.invoke('zapi-webhook', {
                              body: testPayload,
                              headers: { 'x-barber-id': tenantId }
                            }),
                            {
                              loading: 'Simulando clique...',
                              success: (res) => {
                                if (res.data?.success) return 'Simulação concluída! Verifique os logs.';
                                throw new Error(res.data?.error || 'Erro na simulação');
                              },
                              error: (err) => `Erro: ${err.message}`
                            }
                          );
                        }}
                        disabled={!instance}
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8"
                      >
                        <Send className="mr-2" size={14} />
                        Testar Webhook (Simular Clique)
                      </Button>
                      <Button 
                        onClick={reconfigureWebhook} 
                        disabled={isConfiguring || !instance}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs h-8"
                      >
                        {isConfiguring ? <Loader2 className="animate-spin mr-2" size={14} /> : <RefreshCw className="mr-2" size={14} />}
                        Reconfigurar na Z-API
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Barber ID (Tenant)</p>
                      <p className="font-mono text-blue-300">{tenantId || "---"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Instance ID</p>
                      <p className="font-mono text-emerald-300">{instance?.instance_id || "---"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Status da Instância</p>
                      <Badge variant="outline" className={cn("text-[10px] py-0 font-bold", isConnected ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" : "text-red-400 border-red-400/20 bg-red-400/5")}>
                        {isConnected ? "Conectada" : "Desconectada"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">Telefone Conectado</p>
                      <p className="font-mono">{instance?.phone || "---"}</p>
                    </div>
                  </div>

                  {instance?.webhook_received_url && (
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <p className="text-slate-500 uppercase text-[10px] font-bold">Webhook Configurado Localmente</p>
                      <div className="bg-black/30 p-2 rounded font-mono text-[10px] break-all border border-white/5 text-slate-300">
                        {instance.webhook_received_url}
                      </div>
                      <p className="text-[9px] text-slate-500 italic flex justify-between">
                        <span>Configurado em: {new Date(instance.webhook_received_configured_at || "").toLocaleString()}</span>
                        <span className="text-blue-400 font-bold uppercase tracking-tighter">✔ Configuração Sincronizada</span>
                      </p>
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
              <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status do Webhook na Z-API</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500">URL Configurada no Sistema</p>
                      <div className="bg-black/40 p-2 rounded text-[10px] font-mono truncate text-blue-300">
                        {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook/${tenantId}`}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500">Eventos Habilitados</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ReceivedCallback</Badge>
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ButtonResponse</Badge>
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ListResponse</Badge>
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">MessageStatus</Badge>
                      </div>
                    </div>
                  </div>

                  {lastReceivedConfig && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase">Último Retorno da Z-API (Webhook)</p>
                      <pre className="bg-black/30 p-2 rounded font-mono text-[9px] overflow-auto max-h-32 text-emerald-300/70">
                        {JSON.stringify(lastReceivedConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={reconfigureWebhook} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-9 text-xs"
                    disabled={isConfiguring}
                  >
                    {isConfiguring ? <Loader2 className="animate-spin mr-2" size={14} /> : <RefreshCw className="mr-2" size={14} />}
                    Forçar Reconfiguração de Webhooks
                  </Button>
                </div>
              </div>

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

          <TabsContent value="diagnostico" className="pt-4 space-y-4">
            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-blue-400">
                    <MessageSquare size={16} />
                    Teste Real de Botões
                  </h3>
                  <p className="text-[10px] text-blue-300/70">
                    Envia um botão interativo para o seu número e valida se a Z-API devolve o clique.
                  </p>
                </div>
                <Button 
                  onClick={sendTestButtonMessage} 
                  disabled={isSendingButtonTest || !instance}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-[10px] h-8"
                >
                  {isSendingButtonTest ? <Loader2 className="animate-spin mr-1" size={12} /> : <Send className="mr-1" size={12} />}
                  Testar recebimento de resposta
                </Button>
              </div>
            </div>

            {/* Nova Seção: Teste de URL Pública Exclusiva */}
            <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                    <ShieldCheck size={16} />
                    Validação de URL Pública (zapi-receive-json)
                  </h3>
                  <p className="text-[10px] text-emerald-300/70">
                    URL exclusiva sem autenticação para testes de entrega do suporte Z-API.
                  </p>
                </div>
                <Button 
                  onClick={configureNewZApiUrl} 
                  disabled={isConfiguringNew || !instance}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-[10px] h-8"
                >
                  {isConfiguringNew ? <Loader2 className="animate-spin mr-1" size={12} /> : <Zap className="mr-1" size={12} />}
                  Configurar nova URL na Z-API
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Nova URL para o Suporte</Label>
                <div className="bg-black/40 p-2 rounded font-mono text-[10px] break-all border border-emerald-500/20 flex justify-between items-center group">
                  <span className="text-emerald-300">
                    {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-receive-json`}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-60 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-receive-json`;
                      navigator.clipboard.writeText(url);
                      toast.success("URL copiada!");
                    }}
                  >
                    <Copy size={12} />
                  </Button>
                </div>
              </div>

              {lastNewWebhookResult && (
                <div className="bg-black/40 p-3 rounded-lg border border-emerald-500/10 space-y-2">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Status da Configuração</span>
                    <Badge className={lastNewWebhookResult.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                      {lastNewWebhookResult.success ? "SUCESSO" : "FALHA"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <div className="bg-black/20 p-2 rounded border border-white/5">
                      <p className="text-slate-500 uppercase font-bold mb-1">Status HTTP</p>
                      <p className="font-bold">{lastNewWebhookResult.status}</p>
                    </div>
                    <div className="bg-black/20 p-2 rounded border border-white/5">
                      <p className="text-slate-500 uppercase font-bold mb-1">Resposta value</p>
                      <p className="font-bold text-emerald-400">{String(lastNewWebhookResult.result?.value)}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-500 uppercase text-[9px] font-bold">Resposta Completa Z-API</p>
                    <pre className="text-[9px] bg-black/40 p-2 rounded border border-white/5 font-mono overflow-auto max-h-24">
                      {JSON.stringify(lastNewWebhookResult.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 space-y-4">

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Activity size={16} className="text-blue-400" />
                  Estado da Integração
                </h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={reconfigureWebhook} 
                    disabled={isConfiguring || !instance}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-[10px] h-8"
                  >
                    {isConfiguring ? <Loader2 className="animate-spin mr-1" size={12} /> : <RefreshCw className="mr-1" size={12} />}
                    Reconfigurar Webhook
                  </Button>
                  <Button 
                    onClick={runExpandedWebhookTest} 
                    disabled={isConfiguring || !instance}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-[10px] h-8"
                  >
                    {isConfiguring ? <Loader2 className="animate-spin mr-1" size={12} /> : <Zap className="mr-1" size={12} />}
                    Teste Ampliado Webhooks
                  </Button>
                  <Button 
                    onClick={sendTestMessage} 
                    disabled={isSendingTest || !instance}
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-[10px] h-8"
                  >
                    {isSendingTest ? <Loader2 className="animate-spin mr-1" size={12} /> : <Send className="mr-1" size={12} />}
                    Enviar Mensagem Teste
                  </Button>

                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Instance ID</p>
                  <p className="font-mono truncate">{instance?.instance_id || "---"}</p>
                </div>
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Provider</p>
                  <p className="">Z-API (WhatsApp)</p>
                </div>
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Status</p>
                  <Badge variant="outline" className={cn("text-[9px] py-0 h-4", isConnected ? "text-emerald-400 border-emerald-400/20" : "text-red-400 border-red-400/20")}>
                    {isConnected ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Número Conectado</p>
                  <p className="font-mono">{instance?.phone || "---"}</p>
                </div>
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Token</p>
                  <p className="font-mono">{maskToken(instance?.token || "")}</p>
                </div>
                <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Client Token</p>
                  <p className="font-mono">{maskToken(instance?.client_token || "")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] text-slate-500 uppercase font-bold">URL Webhook "Ao Receber" (Configuração Local)</Label>
                <div className="bg-black/40 p-2 rounded font-mono text-[10px] break-all border border-white/10 flex justify-between items-center group">
                  <span className="text-blue-300">
                    {instance?.webhook_received_url || "Não configurado"}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (instance?.webhook_received_url) {
                        navigator.clipboard.writeText(instance.webhook_received_url);
                        toast.success("URL copiada!");
                      }
                    }}
                  >
                    <Copy size={12} />
                  </Button>
                </div>
              </div>

              {lastCheckTime && (
                <div className="text-[10px] text-slate-500 italic">
                  Última configuração: {new Date(lastCheckTime).toLocaleString()}
                </div>
              )}
            </div>

            {lastWebhookCall && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-amber-400">
                    <Activity size={16} />
                    Resultado da Última Configuração de Webhook
                  </h3>
                  <Badge className={lastWebhookCall.success && lastWebhookCall.result?.value === true ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                    {lastWebhookCall.success && lastWebhookCall.result?.value === true ? "Sucesso" : "Falha"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Endpoint Chamado</p>
                    <p className="text-[10px] font-mono break-all bg-black/40 p-2 rounded border border-white/5">
                      {lastWebhookCall.endpoint}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Status HTTP</p>
                    <p className={cn(
                      "text-[10px] font-bold p-2 bg-black/40 rounded border border-white/5",
                      lastWebhookCall.status >= 200 && lastWebhookCall.status < 300 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {lastWebhookCall.status}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Headers (Mascarados)</p>
                    <pre className="text-[9px] bg-black/40 p-2 rounded border border-white/5 font-mono">
                      {JSON.stringify(lastWebhookCall.headers, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Body Enviado</p>
                    <pre className="text-[9px] bg-black/40 p-2 rounded border border-white/5 font-mono">
                      {JSON.stringify(lastWebhookCall.requestBody, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Resposta Completa da Z-API</p>
                  <pre className="text-[9px] bg-black/40 p-2 rounded border border-white/5 font-mono overflow-auto max-h-40">
                    {JSON.stringify(lastWebhookCall.result, null, 2)}
                  </pre>
                </div>

                {!lastWebhookCall.success || lastWebhookCall.result?.value !== true ? (
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>A Z-API não confirmou a configuração (value: true). Verifique se o Client-Token e Instance ID estão corretos.</span>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>Configuração confirmada pela Z-API. O webhook agora deve estar ativo.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Terminal size={16} className="text-amber-400" />
                Logs de Integração (zapi_integration_logs)
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                {integrationLogs.map((log) => (
                  <div key={log.id} className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-bold bg-blue-500/10">
                            {log.action}
                          </Badge>
                          <span className={cn(
                            "text-[10px] font-bold",
                            log.status_code >= 200 && log.status_code < 300 ? "text-emerald-400" : "text-red-400"
                          )}>
                            HTTP {log.status_code}
                          </span>
                        </div>
                        {log.phone_number && (
                          <span className="text-[10px] text-blue-300 flex items-center gap-1">
                            <Phone size={10} /> {log.phone_number}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    {log.endpoint && (
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                          <ExternalLink size={10} /> Endpoint
                        </p>
                        <p className="text-[9px] font-mono break-all text-slate-400 bg-black/20 p-1 rounded">
                          {log.endpoint}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-500 uppercase">Tokens (Mascarados)</p>
                        <div className="text-[9px] bg-black/20 p-2 rounded text-slate-400 space-y-1">
                          <p>Token: {log.token_masked || "---"}</p>
                          <p>Client: {log.client_token_masked || "---"}</p>
                        </div>
                      </div>
                      {log.error_message && (
                        <div className="space-y-1">
                          <p className="text-[9px] text-red-500 uppercase font-bold">Erro</p>
                          <p className="text-[9px] bg-red-500/10 p-2 rounded text-red-300 border border-red-500/20">
                            {log.error_message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase">Resposta Completa</p>
                      <pre className="text-[9px] bg-black/20 p-2 rounded overflow-auto max-h-32 text-slate-300 font-mono">
                        {JSON.stringify(log.response_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
                {integrationLogs.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-white/10 rounded-lg text-slate-500 text-xs">
                    Nenhum log de integração encontrado.
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Terminal size={16} className="text-blue-400" />
                Teste de Webhook Externo
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-slate-400">URL temporária do webhook</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-[10px] text-blue-400 hover:text-blue-300"
                        onClick={() => setTempWebhookUrl("https://ancient-meadow-00.webhook.cool")}
                      >
                        Webhook.cool
                      </Button>
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-[10px] text-amber-400 hover:text-amber-300"
                        onClick={() => {
                          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
                          setTempWebhookUrl(`${supabaseUrl}/functions/v1/zapi-catch-all`);
                        }}
                      >
                        URL Catch-All
                      </Button>
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-[10px] text-emerald-400 hover:text-emerald-300"
                        onClick={() => {
                          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
                          setTempWebhookUrl(`${supabaseUrl}/functions/v1/zapi-receive-json`);
                        }}
                      >
                        URL JSON (Pública)
                      </Button>
                    </div>

                  </div>
                  <Input 
                    value={tempWebhookUrl}
                    onChange={e => setTempWebhookUrl(e.target.value)}
                    className="bg-white/5 border-white/10 text-xs"
                    placeholder="https://sua-url-de-teste.com"
                  />
                  <p className="text-[9px] text-slate-500 italic">
                    Use a URL Catch-All para verificar se o problema é na lógica da função principal ou na entrega da Z-API.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Button 
                    onClick={() => applyTempWebhook('update-webhook-received')}
                    disabled={isConfiguringTemp || !instance}
                    size="sm"
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 text-[10px] h-8"
                  >
                    {isConfiguringTemp ? <Loader2 className="animate-spin mr-1" size={12} /> : null}
                    Aplicar em "Ao Receber"
                  </Button>
                  <Button 
                    onClick={() => applyTempWebhook('update-every-webhooks')}
                    disabled={isConfiguringTemp || !instance}
                    size="sm"
                    className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/30 text-[10px] h-8"
                  >
                    {isConfiguringTemp ? <Loader2 className="animate-spin mr-1" size={12} /> : null}
                    Aplicar em "Todos"
                  </Button>
                  <Button 
                    onClick={restoreSaasWebhook}
                    disabled={isConfiguringTemp || !instance}
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-[10px] h-8"
                  >
                    {isConfiguringTemp ? <Loader2 className="animate-spin mr-1" size={12} /> : null}
                    Restaurar Webhook SaaS
                  </Button>
                </div>

                {lastTempWebhookResult && (
                  <div className="mt-4 bg-black/40 p-3 rounded-lg border border-white/5 space-y-2">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Resultado do Teste Externo</span>
                      <span className="text-[9px] text-slate-500">{new Date(lastTempWebhookResult.timestamp).toLocaleString()}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                      <div className="space-y-1">
                        <p className="text-slate-500 uppercase font-bold text-[8px]">URL Aplicada</p>
                        <p className="font-mono truncate text-blue-300">{lastTempWebhookResult.webhookApplied}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500 uppercase font-bold text-[8px]">Status HTTP</p>
                        <p className={cn("font-bold", lastTempWebhookResult.status === 200 ? "text-emerald-400" : "text-red-400")}>
                          {lastTempWebhookResult.status}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-bold text-[8px]">Endpoint Chamado</p>
                      <p className="font-mono text-[9px] break-all bg-black/20 p-1 rounded text-slate-400">
                        {lastTempWebhookResult.endpoint}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-slate-500 uppercase font-bold text-[8px]">Resposta Z-API</p>
                      <pre className="text-[9px] bg-black/20 p-2 rounded overflow-auto max-h-24 text-slate-300 font-mono">
                        {JSON.stringify(lastTempWebhookResult.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 text-amber-400">
                  <FileText size={16} />
                  Relatório para Suporte Z-API
                </h3>
                <Button 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700 text-xs h-8"
                  onClick={() => {
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
                    const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;
                    
                    const report = `### RELATÓRIO PARA SUPORTE Z-API ###
Instance ID: ${instance?.instance_id || "---"}
Token (Mascarado): ${maskToken(instance?.token || "")}
Client Token (Mascarado): ${maskToken(instance?.client_token || "")}
Webhook URL Configurada: ${webhookUrl}

[CONFIGURAÇÃO WEBHOOK AO RECEBER]
Resposta Z-API: ${JSON.stringify(lastReceivedConfig?.result || "N/A", null, 2)}

[CONFIGURAÇÃO TESTE AMPLIADO (EVERY-WEBHOOKS)]
Resposta Z-API: ${JSON.stringify(lastExpandedConfig?.result || "N/A", null, 2)}

[TESTE DE ENVIO REAL]
Último Message ID: ${lastSentMessageInfo?.id || "N/A"}
Horário do Envio (UTC): ${lastSentMessageInfo?.time ? new Date(lastSentMessageInfo.time).toISOString() : "N/A"}
Horário da Resposta no WhatsApp: [PREENCHER AQUI SE SOUBER]

[DIAGNÓSTICO]
O servidor da aplicação não recebeu nenhum callback/payload para o messageId acima, apesar das configurações retornarem 'value: true' da Z-API.
A Edge Function está operacional (testada via GET/POST manual).`;
                    
                    navigator.clipboard.writeText(report);
                    toast.success("Relatório copiado para a área de transferência!");
                  }}
                >
                  <Copy className="mr-2" size={14} />
                  Copiar relatório para suporte
                </Button>
              </div>

              <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-3 font-mono text-[10px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Instance ID:</span>
                    <span className="text-slate-300">{instance?.instance_id || "---"}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Last Message ID:</span>
                    <span className="text-blue-400">{lastSentMessageInfo?.id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Config Received:</span>
                    <span className={lastReceivedConfig?.success ? "text-emerald-400" : "text-red-400"}>
                      {lastReceivedConfig?.success ? "Sucesso" : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Config Expanded:</span>
                    <span className={lastExpandedConfig?.success ? "text-emerald-400" : "text-red-400"}>
                      {lastExpandedConfig?.success ? "Sucesso" : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <p className="text-slate-500 uppercase text-[9px] font-bold">Resumo do Problema:</p>
                  <p className="text-slate-300 bg-red-500/5 p-2 rounded border border-red-500/10 italic">
                    "A instância envia mensagens e as configurações de webhook retornam sucesso (value: true), mas nenhum callback de recebimento ou status chega na URL configurada. Testes server-side confirmam que a URL está acessível e funcional."
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
