
import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Trash2, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, Zap, History, Send, QrCode, Phone, Loader2, Info, Save } from "lucide-react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  server_url: string;
  api_key: string;
  status: string;
  phone: string | null;
  last_connection: string | null;
  webhook_url: string | null;
}

export function EvolutionWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testNumber, setTestNumber] = useState("");

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
        .eq("barbershop_id", tenantId)
        .maybeSingle();

      if (data) setConnection(data as unknown as WhatsAppConnection);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("user_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setLogs(data);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = {
      barbershop_id: tenantId,
      instance_name: formData.get('instance_name') as string,
      server_url: formData.get('server_url') as string,
      api_key: formData.get('api_key') as string,
    };

    const { data: saved, error } = connection?.id 
      ? await supabase.from("whatsapp_connections").update(data).eq("id", connection.id).select().single()
      : await supabase.from("whatsapp_connections").insert([data]).select().single();

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      setConnection(saved as unknown as WhatsAppConnection);
      toast.success("Configurações salvas!");
      
      // Auto-set webhook after saving
      setupWebhook(saved as unknown as WhatsAppConnection);
    }
  }

  async function setupWebhook(conn: WhatsAppConnection) {
    try {
      const webhookUrl = `${window.location.origin}/api/webhooks/evolution`;
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: { 
          action: 'set-webhook', 
          connectionId: conn.id,
          data: { webhookUrl }
        }
      });
      
      if (!error) {
        await supabase.from("whatsapp_connections").update({ webhook_url: webhookUrl }).eq("id", conn.id);
        console.log("Webhook configured automatically");
      }
    } catch (err) {
      console.error("Error setting up webhook", err);
    }
  }

  async function handleGetQrCode() {
    if (!connection) return;
    setQrLoading(true);
    setQrCode(null);
    setShowQrModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: { action: 'get-qrcode', connectionId: connection.id }
      });

      if (error) throw error;
      if (data.code) {
        setQrCode(data.code);
      } else if (data.base64) {
        setQrCode(data.base64);
      }
      
      // Start polling for status
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
      // Check if modal is still open before polling
      // Note: This is a bit tricky with React state in intervals, 
      // but fetchConnection will update state if it connects
      try {
        const { data, error } = await supabase.functions.invoke('evolution-api', {
          body: { action: 'get-status', connectionId: connection?.id }
        });

        if (data?.instance?.state === 'open') {
          clearInterval(interval);
          setShowQrModal(false);
          toast.success("WhatsApp conectado com sucesso!");
          fetchConnection();
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 5000);

    // Stop polling if we explicitly close the modal
    // This is handled by the useEffect return usually, but here we'll just let it run or check modal state if we had a ref
  }

  async function handleDisconnect() {
    if (!connection || !confirm("Deseja realmente desconectar o WhatsApp?")) return;
    
    setLoading(true);
    try {
      await supabase.functions.invoke('evolution-api', {
        body: { action: 'logout', connectionId: connection.id }
      });
      
      await supabase.from("whatsapp_connections").update({ status: 'disconnected' }).eq("id", connection.id);
      
      toast.success("WhatsApp desconectado");
      fetchConnection();
    } catch (err) {
      toast.error("Erro ao desconectar");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    if (!connection || !testNumber) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: { 
          action: 'test-connection', 
          connectionId: connection.id,
          data: { number: testNumber }
        }
      });
      
      if (error) throw error;
      toast.success("Mensagem de teste enviada!");
    } catch (err) {
      toast.error("Erro ao testar conexão");
    } finally {
      setIsTesting(false);
    }
  }

  const getStatusBadge = () => {
    switch (connection?.status) {
      case 'connected':
        return <Badge className="bg-green-500 hover:bg-green-600 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse">Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.5)]">Aguardando QR Code</Badge>;
      default:
        return <Badge variant="destructive" className="shadow-[0_0_10px_rgba(239,68,68,0.5)]">Desconectado</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border-2 border-slate-200 p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col bg-white border-2 border-slate-200 text-black shadow-lg overflow-hidden transition-all hover:border-green-500/30">
        <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-600" />
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-green-50 rounded-xl text-green-600 border border-green-100">
              <MessageSquare size={28} />
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge()}
              {connection?.last_connection && (
                <span className="text-[10px] text-muted-foreground">
                  Última conexão: {formatDistanceToNow(new Date(connection.last_connection), { addSuffix: true, locale: ptBR })}
                </span>
              )}
            </div>
          </div>
          <CardTitle className="text-2xl mt-4 font-bold tracking-tight">WhatsApp (Evolution API)</CardTitle>
          <CardDescription className="text-slate-500">Integração profissional com instâncias dedicadas e estáveis.</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 space-y-6">
          <form id="wa-evolution-form" onSubmit={saveSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  Nome da Instância
                  <Info size={14} className="text-slate-400" />
                </Label>
                <Input name="instance_name" defaultValue={connection?.instance_name} placeholder="ex: barbearia_premium" required className="bg-slate-50 border-slate-200 focus:ring-green-500" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">URL do Servidor</Label>
                <Input name="server_url" defaultValue={connection?.server_url} placeholder="https://api.evolution.com" required className="bg-slate-50 border-slate-200" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="font-semibold">API Key</Label>
              <Input name="api_key" type="password" defaultValue={connection?.api_key} placeholder="************************" required className="bg-slate-50 border-slate-200" />
            </div>

            {connection?.id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Número Conectado</p>
                    <p className="text-sm font-medium">{connection.phone || "Não identificado"}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-md">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Webhook Status</p>
                    <p className="text-sm font-medium truncate max-w-[150px]">{connection.webhook_url ? "Ativo" : "Pendente"}</p>
                  </div>
                </div>
              </div>
            )}
          </form>

          {connection?.id && connection.status !== 'connected' && (
            <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 bg-slate-50/50 group hover:bg-green-50/30 hover:border-green-300 transition-all">
              <div className="p-4 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                <QrCode className="h-12 w-12 text-slate-300 group-hover:text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-700">Conectar WhatsApp</p>
                <p className="text-xs text-slate-500 max-w-[200px] mt-1">Escaneie o QR Code para ativar as automações de mensagens.</p>
              </div>
              <Button onClick={handleGetQrCode} variant="default" className="bg-green-600 hover:bg-green-700 gap-2 px-6">
                <RefreshCw size={18} className={cn(qrLoading && "animate-spin")} />
                Gerar QR Code
              </Button>
            </div>
          )}

          {connection?.status === 'connected' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Número de teste (ex: 5511999999999)" 
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  className="bg-slate-50"
                />
                <Button onClick={testConnection} disabled={isTesting || !testNumber} variant="outline" className="gap-2 shrink-0">
                  {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Testar Conexão
                </Button>
              </div>
              <Button onClick={handleDisconnect} variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 gap-2">
                <Trash2 size={18} /> Desconectar WhatsApp
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50/50 border-t p-4 flex gap-2">
          <Button form="wa-evolution-form" className="flex-1 bg-black hover:bg-slate-800 text-white gap-2">
            <Save size={18} /> Salvar Configurações
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowLogs(!showLogs)} className={cn(showLogs && "bg-slate-200")}>
            <History size={20} className="text-slate-600" />
          </Button>
        </CardFooter>
      </Card>

      {showLogs && (
        <Card className="border-2 border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <History size={18} className="text-slate-500" />
              Logs Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === 'sent' ? "default" : "secondary"} className={cn("text-[10px] uppercase", log.status === 'sent' && "bg-green-500")}>
                        {log.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-slate-600">{log.content}</p>
                    {log.metadata?.phone && <p className="text-[10px] font-mono text-slate-400">{log.metadata.phone}</p>}
                  </div>
                  {log.status === 'failed' && (
                    <AlertCircle size={16} className="text-red-500" />
                  )}
                </div>
              )) : (
                <div className="p-10 text-center text-slate-400 italic">Nenhum log encontrado.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <QrCode className="text-green-600" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o código abaixo com o seu WhatsApp (Configurações {'>'} Aparelhos Conectados).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
            {qrLoading ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <Loader2 size={48} className="animate-spin text-green-600" />
                <p className="text-sm font-medium animate-pulse">Gerando código...</p>
              </div>
            ) : qrCode ? (
              <div className="space-y-6 flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-white">
                  {qrCode.startsWith('http') || qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400">
                      QR Code inválido
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-green-600 font-bold animate-pulse text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Aguardando conexão...
                  </div>
                  <p className="text-[10px] text-slate-400 text-center max-w-[250px]">
                    Não feche esta janela. Ela será fechada automaticamente quando o WhatsApp for pareado.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-red-500 flex flex-col items-center gap-2">
                <AlertCircle size={32} />
                <p>Falha ao carregar QR Code</p>
                <Button onClick={handleGetQrCode} variant="outline" size="sm">Tentar Novamente</Button>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" onClick={() => setShowQrModal(false)} className="text-slate-500">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
