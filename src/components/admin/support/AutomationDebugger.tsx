import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Bug, Info, RefreshCw, Send, CheckCircle, XCircle } from "lucide-react";

export function AutomationDebugger() {
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);

  // Poll for webhook logs
  useEffect(() => {
    let interval: any;
    if (polling && tenantId) {
      interval = setInterval(async () => {
        const { data } = await supabase
          .from("zapi_webhook_debug")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("received_at", { ascending: false })
          .limit(5);
        if (data) setWebhookLogs(data);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, tenantId]);

  const sendTestButton = async () => {
    if (!tenantId || !phone) {
      toast.error("Informe o Tenant ID e o Telefone");
      return;
    }

    setLoading(true);
    setResult(null);
    setPolling(true);
    
    try {
      // 1. Get WhatsApp settings
      const { data: connection } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!connection) throw new Error("Configurações de WhatsApp não encontradas para este tenant.");

      const message = "🧪 Teste de Webhook BarberLM\n\nPor favor, clique no botão abaixo para testar o recebimento do callback.";
      const buttons = [
        { id: "test_confirm", label: "Confirmar Teste" }
      ];

      // We call the edge function to send the message
      // Note: We use automation-engine to trigger a manual send via action
      const { data, error } = await supabase.functions.invoke("automation-engine", {
        body: {
          action: "send_test_message",
          tenantId,
          phone,
          message,
          buttons
        }
      });

      if (error) throw error;

      setResult({
        action: "send_test_message",
        status: "sent",
        response: data,
        instructions: "Clique no botão enviado para o seu WhatsApp e aguarde o log aparecer abaixo."
      });

      toast.success("Botão de teste enviado!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const simulateClick = async () => {
    if (!tenantId) {
      toast.error("Informe o Tenant ID");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data: session, error: sessionError } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError || !session) {
        throw new Error("Nenhuma sessão ativa encontrada.");
      }

      const payload = {
        phone: session.phone,
        referenceMessageId: session.provider_message_id,
        buttonsResponseMessage: {
          buttonId: "main_confirm",
          label: "Confirmar agendamento"
        },
        type: "ReceivedCallback",
        fromMe: false
      };

      const { data, error } = await supabase.functions.invoke("zapi-webhook", {
        body: payload,
        headers: { "x-tenant-id": tenantId }
      });

      if (error) throw error;
      
      setResult({
        session_id: session.id,
        payload_sent: payload,
        response: data
      });
      
      toast.success("Simulação de webhook processada!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bug className="text-primary h-5 w-5" />
            <CardTitle>Diagnóstico de Webhook</CardTitle>
          </div>
          <CardDescription>
            Teste a comunicação real entre Z-API e BarberLM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">Tenant ID</label>
              <Input 
                placeholder="UUID do Tenant" 
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="bg-white/5 border-white/10 text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">Seu Telefone (DDI+DDD+Num)</label>
              <Input 
                placeholder="Ex: 5511999999999" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white/5 border-white/10 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button 
              onClick={sendTestButton} 
              disabled={loading}
              variant="outline"
              className="gap-2 text-xs h-9"
            >
              <Send size={14} /> Enviar Botão Teste
            </Button>
            <Button 
              onClick={simulateClick} 
              disabled={loading}
              variant="secondary"
              className="gap-2 text-xs h-9"
            >
              <Play size={14} /> Simular Webhook (Local)
            </Button>
            <Button 
              onClick={() => setPolling(!polling)} 
              variant={polling ? "default" : "ghost"}
              className="gap-2 text-xs h-9"
            >
              <RefreshCw size={14} className={polling ? "animate-spin" : ""} /> 
              {polling ? "Monitorando..." : "Monitorar Logs"}
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg overflow-auto max-h-[200px]">
              <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase text-primary">
                <Info size={12} /> Status
              </div>
              <pre className="text-[10px] font-mono text-gray-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-md">Logs de Webhook (Realtime)</CardTitle>
            {polling && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
          </div>
          <CardDescription className="text-xs">
            Últimos payloads recebidos da Z-API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {webhookLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 italic">
                Aguardando payloads...
              </div>
            ) : (
              webhookLogs.map((log) => (
                <div key={log.id} className="p-2 bg-white/5 border border-white/10 rounded text-[10px] font-mono">
                  <div className="flex justify-between mb-1 text-gray-400">
                    <span>{new Date(log.received_at).toLocaleTimeString()}</span>
                    <span className="text-primary">{log.option_id || "no_button"}</span>
                  </div>
                  <div className="text-gray-300 truncate">
                    {log.payload_raw?.type || "Unknown"} from {log.phone_normalized}
                  </div>
                  {log.payload_raw?.buttonsResponseMessage && (
                    <div className="mt-1 text-green-400">
                      Button Clicked: {log.payload_raw.buttonsResponseMessage.buttonId}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
