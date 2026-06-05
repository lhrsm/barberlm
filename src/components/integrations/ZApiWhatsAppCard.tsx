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
  const [isSendingButtonTest, setIsSendingButtonTest] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [lastEndpointTestResult, setLastEndpointTestResult] = useState<any>(null);
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
      }

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
        toast.success("Mensagem enviada! Clique no botão no seu WhatsApp.");
        let secondsPassed = 0;
        const maxSeconds = 30;
        const startTime = new Date().toISOString();
        const checkInterval = setInterval(async () => {
          secondsPassed += 3;
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
              error: "Nenhum webhook recebido após 30 segundos."
            });
            toast.error("Tempo esgotado.");
          }
        }, 3000);
      } else {
        setIsWaitingForCallback(false);
        toast.error("Erro ao enviar: " + (data.error || "Erro"));
      }
    } catch (err: any) {
      setIsWaitingForCallback(false);
      toast.error("Erro: " + err.message);
    } finally {
      setIsSendingButtonTest(false);
    }
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
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook-v2`;
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
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook-v2`;
      const { data, error } = await supabase.functions.invoke('zapi-api', { 
        body: { action: 'update-webhook-received', instanceId: instance.id, data: { webhookUrl } } 
      });
      if (error) throw error;
      setLastWebhookCall(data);
      if (isZApiSuccess(data)) toast.success("Configurado com V2!");
      else toast.error("Falha na configuração");
      await fetchInstance();
    } catch (err: any) { toast.error("Erro na reconfiguração"); }
    finally { setIsConfiguring(false); }
  }

  async function testSupabaseEndpoint() {
    if (!instance?.id) return;
    setIsTestingEndpoint(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'test-received-callback', instanceId: instance.id, data: { phone: formData.phone || "5571988939385", text: "1" } }
      });
      if (error) throw error;
      setLastEndpointTestResult(data);
      if (data.success) toast.success("Enviado!");
      else toast.error("Falha");
    } catch (err: any) { toast.error("Erro"); }
    finally { setIsTestingEndpoint(false); }
  }

  const maskTokenDisplay = (token: string | null | undefined) => {
    if (!token) return "---";
    return token.length <= 8 ? "********" : `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <Card className="bg-[#0b0f1a] border-white/10 text-white">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2"><Zap className="text-blue-400" /> Z-API WhatsApp</CardTitle>
          <Badge className={instance?.connected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>{instance?.connected ? "Conectado" : "Desconectado"}</Badge>
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
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-white/5 border-white/10" />
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
              <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" size={16} />} Salvar</Button>
            </form>
          </TabsContent>

          <TabsContent value="diagnostico" className="pt-4 space-y-4">
             <div className="flex flex-wrap gap-2">
                <Button onClick={reconfigureWebhook} disabled={isConfiguring} size="sm" className="bg-blue-600">Configurar Webhook V2</Button>
                <Button onClick={testSupabaseEndpoint} disabled={isTestingEndpoint} size="sm" className="bg-amber-600">Testar Endpoint</Button>
                <Button onClick={sendTestButtonWithCallback} disabled={isSendingButtonTest} size="sm" className="bg-purple-600">Testar WhatsApp Real</Button>
             </div>
             <p className="text-[10px] text-slate-400">URL Atual: {instance?.webhook_received_url || "Nenhuma"}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
