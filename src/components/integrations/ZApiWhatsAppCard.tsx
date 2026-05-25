import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Trash2, CheckCircle2, AlertCircle, Zap, History, Send, QrCode, Phone, Loader2, Info, Save, Smartphone, User, Crown, ExternalLink, ShieldCheck, Copy, Edit3, Trash, Link2, Shield } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface WhatsAppConnection {
  id: string;
  instance_id: string;
  server_url: string;
  instance_token: string;
  client_token: string | null;
  status: string;
  phone: string | null;
  instance_name: string | null;
  webhook_url: string | null;
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string>("qrcode");
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [connectionLink, setConnectionLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchConnection();
      fetchWebhookLogs();
    }
  }, [tenantId]);

  async function fetchConnection() {
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

  async function fetchWebhookLogs() {
    const { data } = await supabase
      .from("webhook_logs")
      .select("*")
      .eq("barbershop_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setWebhookLogs(data);
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

    const baseUrl = `${window.location.origin}/api/webhooks/zapi`;
    
    const webhookUrl = `${baseUrl}/${tenantId}`;
    const upsertData = {
      ...data,
      webhook_url: webhookUrl
    };

    const { data: saved, error } = connection?.id 
      ? await supabase.from("whatsapp_connections").update(upsertData).eq("id", connection.id).select().single()
      : await supabase.from("whatsapp_connections").insert([upsertData]).select().single();

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      setConnection(saved as WhatsAppConnection);
      setTempWebhookUrl(webhookUrl);
      setWebhookModalOpen(true);
      toast.success("Configurações salvas e Webhook gerado!");
      await setupWebhook(saved as WhatsAppConnection);
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
    } catch (err) {
      console.error("Erro ao configurar webhook", err);
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
      setWebhookModalOpen(false);
      toast.success("Webhook excluído com sucesso");
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
      toast.success("Webhook atualizado com sucesso");
    } catch (err) {
      toast.error("Erro ao atualizar webhook");
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

  async function handleGetPairingCode() {
    if (!connection) return;
    if (!pairingPhone) {
      toast.error("Informe o número do WhatsApp");
      return;
    }
    setPairingLoading(true);
    setPairingCode(null);
    setShowPairingModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'get-pairing-code', 
          connectionId: connection.id,
          data: { phone: pairingPhone.replace(/\D/g, '') } 
        }
      });

      if (error) throw error;
      if (data.value) {
        setPairingCode(data.value);
        startPollingStatus();
      } else {
        toast.error("Falha ao gerar código de pareamento");
      }
    } catch (err) {
      toast.error("Erro ao gerar código de pareamento");
      setShowPairingModal(false);
    } finally {
      setPairingLoading(false);
    }
  }

  async function handleGetConnectionLink() {
    if (!connection) return;
    setLinkLoading(true);
    setConnectionLink(null);
    setShowLinkModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-connection-link', connectionId: connection.id }
      });

      if (error) throw error;
      if (data.value) setConnectionLink(data.value);
      
      startPollingStatus();
    } catch (err) {
      toast.error("Erro ao gerar link de conexão");
      setShowLinkModal(false);
    } finally {
      setLinkLoading(false);
    }
  }

  function startPollingStatus() {
    const interval = setInterval(async () => {
      if (!connection?.id) return;
      
      try {
        const { data } = await supabase.functions.invoke('zapi-api', {
          body: { action: 'get-status', connectionId: connection.id }
        });

        console.log('POLLING STATUS DATA:', data);
        const isConnected = 
          data?.connected === true || 
          data?.connected === 'true' || 
          data?.status === 'connected' || 
          data?.value === 'CONNECTED';

        if (isConnected) {
          clearInterval(interval);
          setShowQrModal(false);
          setShowPairingModal(false);
          setShowLinkModal(false);
          toast.success("WhatsApp conectado com sucesso!");
          fetchConnection();
        } else {
          setPollingStatus(data?.waitingQrCode ? "qrcode" : "disconnected");
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }

  // Automatic status polling every 10 seconds when connected or active
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connection?.id) {
      interval = setInterval(() => {
        checkStatusSilently();
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connection?.id]);

  async function checkStatusSilently() {
    if (!connection?.id) return;
    try {
      const { data } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-status', connectionId: connection.id }
      });
      
      const isConnected = 
        data?.connected === true || 
        data?.connected === 'true' || 
        data?.status === 'connected' || 
        data?.value === 'CONNECTED';

      const newStatus = isConnected ? 'connected' : 'disconnected';
      
      if (newStatus !== connection.status) {
        fetchConnection();
      }
    } catch (err) {
      console.error("Silent status check error", err);
    }
  }

  async function handleDisconnect() {
    if (!connection || !confirm("Deseja realmente desconectar?")) return;
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

  async function testConnection() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'test-connection', connectionId: connection.id }
      });

      if (error) throw error;
      
      console.log('instanceId', connection.instance_id);
      console.log('token', connection.instance_token);
      console.log('clientToken', connection.client_token);
      console.log('response', data);

      console.log('STATUS DATA:', data);
      const isConnected = 
        data?.connected === true || 
        data?.connected === 'true' || 
        data?.status === 'connected' || 
        data?.value === 'CONNECTED';

      if (isConnected) {
        toast.success("WhatsApp conectado");
      } else {
        toast.error("WhatsApp desconectado");
      }
      fetchConnection();
    } catch (err) {
      console.error("Test error", err);
      toast.error("Erro ao testar conexão");
    } finally {
      setIsTesting(false);
    }
  }

  async function checkStatus() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const { data } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-status', connectionId: connection.id }
      });
      
      console.log('STATUS DATA:', data);
      console.log('CONNECTED:', data?.connected);
      console.log('TYPE:', typeof data?.connected);
      const isConnected = 
        data?.connected === true || 
        data?.connected === 'true' || 
        data?.status === 'connected' || 
        data?.value === 'CONNECTED';

      if (isConnected) {
        toast.success("Status: Conectado");
      } else {
        toast.error("Status: Desconectado");
      }
      fetchConnection();
    } catch (err) {
      toast.error("Erro ao verificar status");
    } finally {
      setIsTesting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="space-y-6">
      <Card className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl"><Zap /></div>
              <div>
                <CardTitle>WhatsApp Z-API</CardTitle>
                <CardDescription className="text-slate-400">Integração SaaS Premium</CardDescription>
              </div>
            </div>
            <Badge className={cn(
              "transition-all duration-500",
              connection?.status === 'connected' 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            )}>
              {connection?.status === 'connected' ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  WhatsApp conectado
                </span>
              ) : 'WhatsApp desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
           <form id="wa-zapi-form" onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-slate-300">ID da Instância</Label>
                <Input name="instance_id" defaultValue={connection?.instance_id} className="bg-white/5 border-white/10" required />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300">Token da Instância</Label>
                <Input name="instance_token" type="password" defaultValue={connection?.instance_token} className="bg-white/5 border-white/10" required />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300">Client Token</Label>
                <Input name="client_token" type="password" defaultValue={connection?.client_token || ""} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300">URL Base</Label>
                <Input name="server_url" defaultValue={connection?.server_url || "https://api.z-api.io"} className="bg-white/5 border-white/10" />
              </div>
              <div className="md:col-span-2 flex flex-col md:flex-row gap-4">
                <Button type="submit" className="flex-1 bg-white text-black hover:bg-slate-200">
                  <Save size={16} className="mr-2" /> Salvar Configurações
                </Button>
                {connection?.id && (
                  <Button 
                    type="button" 
                    onClick={testConnection} 
                    disabled={isTesting}
                    variant="outline" 
                    className="flex-1 border-white/10 hover:bg-white/5"
                  >
                    {isTesting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                    Testar conexão Z-API
                  </Button>
                )}
              </div>
           </form>
           
           {connection?.id && connection.status !== 'connected' && (
              <div className="md:col-span-2 space-y-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-bold uppercase text-slate-300 flex items-center gap-2">
                  <Shield size={16} /> Métodos de Conexão
                </h3>
                <Tabs defaultValue="qrcode" className="w-full">
                  <TabsList className="grid grid-cols-3 bg-white/5 p-1 h-12 rounded-xl mb-6">
                    <TabsTrigger value="qrcode"><QrCode size={14} className="mr-2" /> QR Code</TabsTrigger>
                    <TabsTrigger value="pairing"><Smartphone size={14} className="mr-2" /> Código</TabsTrigger>
                    <TabsTrigger value="link"><Link2 size={14} className="mr-2" /> Link</TabsTrigger>
                  </TabsList>
                  <TabsContent value="qrcode">
                    <Button onClick={handleGetQrCode} disabled={qrLoading} className="w-full h-20 bg-blue-600">
                      {qrLoading ? <Loader2 className="animate-spin" /> : "Gerar QR Code"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="pairing" className="space-y-4">
                    <Input placeholder="Número c/ DDI e DDD" value={pairingPhone} onChange={(e) => setPairingPhone(e.target.value)} />
                    <Button onClick={handleGetPairingCode} disabled={pairingLoading} className="w-full">
                      {pairingLoading ? <Loader2 className="animate-spin" /> : "Gerar Código"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="link">
                    <Button onClick={handleGetConnectionLink} disabled={linkLoading} className="w-full h-20">
                      {linkLoading ? <Loader2 className="animate-spin" /> : "Gerar Link"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
           )}

           {connection?.id && (
             <div className="pt-6 border-t border-white/10 flex flex-wrap gap-3">
               <Button 
                onClick={checkStatus} 
                disabled={isTesting}
                variant="outline" 
                className="flex-1 border-white/10 hover:bg-white/5 min-w-[140px]"
               >
                 {isTesting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                 Atualizar status
               </Button>
               {connection.status === 'connected' && (
                 <Button onClick={handleDisconnect} variant="destructive" className="flex-1 min-w-[140px]">
                   <Trash2 size={14} className="mr-2" /> Desconectar
                 </Button>
               )}
             </div>
           )}
        </CardContent>
      </Card>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="bg-[#0b0f1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>Use o WhatsApp para escanear o código abaixo.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4 bg-white rounded-xl">
            {qrCode ? <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR" /> : <Loader2 className="animate-spin" />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPairingModal} onOpenChange={setShowPairingModal}>
        <DialogContent className="bg-[#0b0f1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Código de Pareamento</DialogTitle>
            <DialogDescription>Insira este código no seu WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-4xl font-mono font-bold text-blue-400">{pairingCode || <Loader2 className="animate-spin mx-auto" />}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="bg-[#0b0f1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Link de Conexão</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-white/5 rounded-lg break-all">
            {connectionLink || <Loader2 className="animate-spin mx-auto" />}
          </div>
          <Button onClick={() => connectionLink && window.open(connectionLink, '_blank')}>Abrir Link</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookModalOpen} onOpenChange={setWebhookModalOpen}>
        <DialogContent className="bg-[#0b0f1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Configuração de Webhook</DialogTitle>
          </DialogHeader>
          <Input value={tempWebhookUrl} onChange={(e) => setTempWebhookUrl(e.target.value)} readOnly={!isEditingWebhook} />
          <div className="flex gap-2">
            {isEditingWebhook ? (
              <Button onClick={handleUpdateWebhook}>Salvar</Button>
            ) : (
              <Button onClick={() => setIsEditingWebhook(true)}>Editar</Button>
            )}
            <Button variant="destructive" onClick={handleDeleteWebhook}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
