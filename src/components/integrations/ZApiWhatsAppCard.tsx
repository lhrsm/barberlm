import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Trash2, CheckCircle2, AlertCircle, Zap, History, Send, QrCode, Phone, Loader2, Info, Save, Smartphone, User, Crown, ExternalLink, ShieldCheck } from "lucide-react";
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
  const [testNumber, setTestNumber] = useState("");
  const [pollingStatus, setPollingStatus] = useState<string>("qrcode");
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchConnection();
      fetchWebhookLogs();
    }
  }, [tenantId]);

  async function fetchWebhookLogs() {
    const { data } = await supabase
      .from("webhook_logs")
      .select("*")
      .eq("barbershop_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setWebhookLogs(data);
  }

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
        } else {
          setPollingStatus(data?.waitingQrCode ? "qrcode" : "disconnected");
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 5000);
    
    // Cleanup if modal closes
    return () => clearInterval(interval);
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

  async function checkStatus() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const { data } = await supabase.functions.invoke('zapi-api', {
        body: { action: 'get-status', connectionId: connection.id }
      });
      if (data?.connected) {
        toast.success("WhatsApp conectado!");
      } else {
        toast.error("WhatsApp desconectado.");
      }
      fetchConnection();
    } catch (err) {
      toast.error("Erro ao verificar status");
    } finally {
      setIsTesting(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-[#0b0f1a] border-slate-800 p-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-slate-400 animate-pulse">Carregando integração...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -ml-32 -mb-32 rounded-full pointer-events-none" />
          
          <CardHeader className="relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                  <Zap className="text-white" size={24} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold tracking-tight">WhatsApp Z-API</CardTitle>
                  <CardDescription className="text-slate-400">Integração SaaS Premium</CardDescription>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={connection?.status}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge className={cn(
                    "px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest border transition-all duration-500",
                    connection?.status === 'connected' 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                      : "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  )}>
                    {connection?.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </motion.div>
              </AnimatePresence>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-8 relative">
            <form id="wa-zapi-form" onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium">ID da Instância</Label>
                <div className="relative group">
                  <Smartphone className="absolute left-3 top-3 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input 
                    name="instance_id" 
                    defaultValue={connection?.instance_id} 
                    className="bg-white/5 border-white/10 pl-10 focus:ring-2 focus:ring-blue-500/50 transition-all text-white placeholder:text-slate-600" 
                    placeholder="Ex: 3C5..."
                    required 
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium">Token da Instância</Label>
                <Input 
                  name="instance_token" 
                  type="password" 
                  defaultValue={connection?.instance_token} 
                  placeholder="••••••••••••••••" 
                  className="bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/50 transition-all text-white" 
                  required 
                />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium">Client Token</Label>
                <Input 
                  name="client_token" 
                  type="password" 
                  defaultValue={connection?.client_token || ""} 
                  placeholder="Opcional" 
                  className="bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/50 transition-all text-white" 
                />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium">URL Base</Label>
                <Input 
                  name="server_url" 
                  defaultValue={connection?.server_url || "https://api.z-api.io"} 
                  className="bg-white/5 border-white/10 focus:ring-2 focus:ring-blue-500/50 transition-all text-white" 
                />
              </div>
              
              <div className="md:col-span-2">
                <Button type="submit" className="w-full h-12 bg-white text-black hover:bg-slate-200 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group">
                  <Save size={18} className="mr-2 group-hover:scale-110 transition-transform" /> 
                  Salvar Configurações & Ativar Webhook
                </Button>
              </div>
            </form>

            <AnimatePresence>
              {connection?.id && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {connection.status === 'connected' ? (
                    <>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                          <User className="text-blue-400" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Conectado como</p>
                          <p className="font-bold text-white">{connection.instance_name || "Perfil WhatsApp"}</p>
                          <p className="text-xs text-slate-400">{connection.phone || "Número indisponível"}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                          <CheckCircle2 className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Status API</p>
                          <p className="font-bold text-emerald-400">Ativo & Operacional</p>
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 bg-white/5 rounded-2xl p-6 border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap size={16} className="text-blue-400" />
                            <h4 className="text-sm font-bold text-white uppercase tracking-tight">Gerenciamento Webhook</h4>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-black/20 border-white/10 hover:bg-white/5"
                            onClick={() => {
                              navigator.clipboard.writeText(`https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/zapi-webhook/${tenantId}`);
                              toast.success("Webhook copiado!");
                            }}
                          >
                            Copiar URL
                          </Button>
                        </div>
                        
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] font-mono text-slate-400 break-all">
                          https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/zapi-webhook/{tenantId}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: "Mensagens", type: "received" },
                            { label: "Status", type: "message-status" },
                            { label: "Conexão", type: "connected" },
                            { label: "Desconexão", type: "disconnected" }
                          ].map((wh) => (
                            <div key={wh.type} className="flex flex-col gap-2 p-3 bg-black/20 rounded-xl border border-white/5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{wh.label}</span>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={true} readOnly className="accent-blue-500" />
                                <span className="text-[10px] text-emerald-400 uppercase font-bold">Ativo</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button 
                          onClick={async () => {
                            const { data, error } = await supabase.functions.invoke('zapi-api', {
                              body: { 
                                action: 'test-webhook', 
                                connectionId: connection.id,
                                data: { webhookUrl: `https://wdxhjwodyctgzqtogkgv.supabase.co/functions/v1/zapi-webhook/${tenantId}` }
                              }
                            });
                            if (error) toast.error("Erro no teste");
                            else toast.success(data.message);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                        >
                          Testar Webhook
                        </Button>
                      </div>
                      <div className="md:col-span-2 flex gap-3">
                        <Button onClick={checkStatus} disabled={isTesting} variant="outline" className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 h-12 rounded-xl">
                          <RefreshCw size={18} className={cn("mr-2", isTesting && "animate-spin")} /> Verificar Status
                        </Button>
                        <Button onClick={handleDisconnect} variant="destructive" className="flex-1 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 h-12 rounded-xl">
                          <Trash2 size={18} className="mr-2" /> Desconectar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button onClick={handleGetQrCode} disabled={qrLoading} className="md:col-span-2 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-lg rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.3)]">
                      {qrLoading ? <Loader2 className="animate-spin mr-2" /> : <QrCode size={24} className="mr-2" />}
                      Parear WhatsApp
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          
          <CardFooter className="bg-black/40 border-t border-white/5 py-3 px-6 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <ShieldCheck size={12} className="text-emerald-500" /> SECURE INTEGRATION
            </div>
            <a href="https://z-api.io" target="_blank" rel="noreferrer" className="text-[10px] text-slate-500 hover:text-white transition-colors flex items-center gap-1">
              Documentação Oficial <ExternalLink size={10} />
            </a>
          </CardFooter>
        </Card>
      </motion.div>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="bg-[#0b0f1a] border-white/10 text-white sm:max-w-md p-0 overflow-hidden rounded-3xl">
          <div className="p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] -mr-16 -mt-16 rounded-full" />
            
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-center text-white flex flex-col items-center gap-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <QrCode className="text-blue-500" size={32} />
                </div>
                Conexão Instantânea
              </DialogTitle>
              <DialogDescription className="text-center text-slate-400 pt-2">
                Escaneie o código abaixo com o seu dispositivo para ativar o BarberLM WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center">
              <div className="relative p-6 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)] group">
                {qrLoading ? (
                  <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-blue-500" />
                    <p className="text-slate-900 font-bold animate-pulse text-sm">Gerando Token...</p>
                  </div>
                ) : qrCode ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                  >
                    <img 
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                      alt="QR" 
                      className="w-64 h-64 relative z-10" 
                    />
                    <div className="absolute inset-0 bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 transition-all duration-700" />
                  </motion.div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-slate-400 italic">
                    Erro ao carregar QR Code.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    pollingStatus === 'qrcode' ? "bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" : "bg-red-500"
                  )} />
                  <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">
                    {pollingStatus === 'qrcode' ? 'Aguardando Leitura' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase font-black">Live Sync</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-xl border border-white/5">
                  <Smartphone size={14} className="text-blue-400" />
                  <span className="text-[8px] uppercase text-slate-500">Abrir Whats</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-xl border border-white/5">
                  <Crown size={14} className="text-blue-400" />
                  <span className="text-[8px] uppercase text-slate-500">Configurações</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-xl border border-white/5">
                  <User size={14} className="text-blue-400" />
                  <span className="text-[8px] uppercase text-slate-500">Conectar</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
