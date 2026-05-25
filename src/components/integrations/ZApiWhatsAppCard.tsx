import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Trash2, CheckCircle2, AlertCircle, Zap, History, Send, QrCode, Phone, Loader2, Info, Save, Smartphone, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppConnection {
  id: string;
  instance_id: string;
  server_url: string;
  instance_token: string;
  client_token: string | null;
  status: string;
  phone: string | null;
  webhook_url: string | null;
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testNumber, setTestNumber] = useState("");

  useEffect(() => {
    if (tenantId) fetchConnection();
  }, [tenantId]);

  async function fetchConnection() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("barbershop_id", tenantId)
        .maybeSingle();

      if (data) setConnection(data as WhatsAppConnection);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = {
      barbershop_id: tenantId,
      instance_id: formData.get('instance_id') as string,
      server_url: formData.get('server_url') as string || "https://api.z-api.io",
      instance_token: formData.get('instance_token') as string,
      client_token: formData.get('client_token') as string,
      provider: 'z-api'
    };

    const { data: saved, error } = connection?.id 
      ? await supabase.from("whatsapp_connections").update(data).eq("id", connection.id).select().single()
      : await supabase.from("whatsapp_connections").insert([data]).select().single();

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      setConnection(saved as WhatsAppConnection);
      toast.success("Configurações salvas!");
      await setupWebhook(saved as WhatsAppConnection);
    }
  }

  async function setupWebhook(conn: WhatsAppConnection) {
    try {
      const { data: { publicUrl } } = supabase.storage.from('functions').getPublicUrl('zapi-webhook');
      // Using direct function URL from env would be better, but we hardcode for this demo
      const webhookUrl = "https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/zapi-webhook";
      
      await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'set-webhook', 
          connectionId: conn.id,
          data: { webhookUrl }
        }
      });
      
      await supabase.from("whatsapp_connections").update({ webhook_url: webhookUrl }).eq("id", conn.id);
    } catch (err) {
      console.error("Erro ao configurar webhook", err);
    }
  }

  async function handleGetQrCode() {
    if (!connection) return;
    setQrLoading(true);
    setQrCode(null);
    setShowQrModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-qrcode', connectionId: connection.id }
      });

      if (error) throw error;
      if (data.value) setQrCode(data.value);
      
      startPollingStatus();
    } catch (err) {
      toast.error("Erro ao gerar QR Code");
      setShowQrModal(false);
    } finally {
      setQrLoading(false);
    }
  }

  function startPollingStatus() {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('zapi-api', {
          body: { action: 'get-status', connectionId: connection?.id }
        });

        if (data?.connected) {
          clearInterval(interval);
          setShowQrModal(false);
          toast.success("WhatsApp conectado com sucesso!");
          fetchConnection();
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 5000);
  }

  async function handleDisconnect() {
    if (!connection) return;
    try {
      await supabase.functions.invoke('zapi-api', {
        body: { action: 'disconnect', connectionId: connection.id }
      });
      await supabase.from("whatsapp_connections").update({ status: 'disconnected' }).eq("id", connection.id);
      toast.success("WhatsApp desconectado");
      fetchConnection();
    } catch (err) {
      toast.error("Erro ao desconectar");
    }
  }

  async function checkStatus() {
    if (!connection) return;
    setIsTesting(true);
    try {
      await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-status', connectionId: connection.id }
      });
      toast.success("Status atualizado!");
      fetchConnection();
    } catch (err) {
      toast.error("Erro ao verificar status");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#0f172a] border border-slate-800 text-white shadow-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
              <Zap className="text-blue-400" size={24} />
            </div>
            {connection?.status && (
              <Badge className={cn("px-3 py-1 font-mono uppercase text-[10px]", 
                connection.status === 'connected' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30")}>
                {connection.status}
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl mt-4">WhatsApp Z-API</CardTitle>
          <CardDescription className="text-slate-400">Integração profissional em tempo real.</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form id="wa-zapi-form" onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID da Instância</Label>
              <Input name="instance_id" defaultValue={connection?.instance_id} className="bg-[#1e293b] border-slate-700" required />
            </div>
            <div className="space-y-2">
              <Label>Token da Instância</Label>
              <Input name="instance_token" type="password" defaultValue={connection?.instance_token} placeholder="••••••••••••" className="bg-[#1e293b] border-slate-700" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Client Token</Label>
              <Input name="client_token" type="password" defaultValue={connection?.client_token || ""} placeholder="••••••••••••" className="bg-[#1e293b] border-slate-700" />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Save size={16} /> Salvar e Configurar Webhook
            </Button>
          </form>

          {connection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {connection.status !== 'connected' ? (
                <Button onClick={handleGetQrCode} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <QrCode size={16} className="mr-2" /> Parear WhatsApp
                </Button>
              ) : (
                <>
                  <Button onClick={checkStatus} className="w-full bg-slate-700 hover:bg-slate-600">
                    <RefreshCw size={16} className="mr-2" /> Verificar Status
                  </Button>
                  <Button onClick={handleDisconnect} variant="destructive" className="w-full">
                    <Trash2 size={16} className="mr-2" /> Desconectar
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="bg-[#0f172a] border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-white">
              <QrCode className="text-blue-500" /> Escaneie o QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {qrLoading ? (
              <Loader2 className="animate-spin text-blue-500" size={48} />
            ) : qrCode ? (
              <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR" className="w-64 h-64 border-4 border-white rounded-lg" />
            ) : (
              <p>Carregando...</p>
            )}
            <p className="mt-4 text-slate-400 text-sm">Aguardando pareamento...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
