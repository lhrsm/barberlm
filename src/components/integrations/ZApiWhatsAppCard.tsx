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
  Phone
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
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [connection, setConnection] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  
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
      fetchConnection();
      fetchLogs();
    }
  }, [tenantId]);

  async function fetchConnection() {
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (data) {
        const conn = data as any;
        setConnection(conn);
        setFormData({
          instance_id: conn.instance_id || "",
          instance_token: conn.token || "",
          client_token: conn.client_token || "",
          api_url: conn.server_url || "https://api.z-api.io",
          phone: conn.phone || ""
        });
        setTempWebhookUrl(conn.webhook_url || "");
      } else {
        const { data: settings } = await supabase
          .from("barbershop_settings")
          .select("*")
          .eq("barber_id", tenantId)
          .maybeSingle();
        
        if (settings) {
          setFormData({
            instance_id: settings.instance_id || "",
            instance_token: settings.instance_token || "",
            client_token: settings.client_token || "",
            api_url: (settings as any).server_url || "https://api.z-api.io",
            phone: settings.whatsapp_number || ""
          });
        }
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

  async function syncInstanceData() {
    if (!connection?.id) {
      toast.error("Salve as configurações primeiro antes de sincronizar.");
      return;
    }
    
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'check-status', 
          connectionId: connection.id 
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success(`Sincronizado! Status: ${data.connected ? 'Conectado' : 'Desconectado'}`);
        await fetchConnection();
      }
    } catch (err: any) {
      toast.error("Erro na sincronização: " + err.message);
    } finally {
      setIsTesting(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    
    const instanceId = formData.instance_id.trim();
    const instanceToken = formData.instance_token.trim();
    const clientToken = formData.client_token.trim();
    const apiBaseUrl = formData.api_url.trim() || "https://api.z-api.io";
    const phone = formData.phone.replace(/\D/g, "");

    if (!phone || phone.length < 10) {
      toast.error("Telefone da instância é obrigatório e deve ser válido (ex: 5571999999999)");
      setIsSaving(false);
      return;
    }

    let cleanApiUrl = apiBaseUrl;
    if (cleanApiUrl.includes('/instances/')) {
      cleanApiUrl = cleanApiUrl.split('/instances/')[0];
    }
    cleanApiUrl = cleanApiUrl.replace(/\/$/, "");

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook/${tenantId}`;

    const upsertData = {
      instance_id: instanceId,
      token: instanceToken,
      client_token: clientToken,
      server_url: cleanApiUrl,
      webhook_url: webhookUrl,
      phone: phone,
      provider: 'z-api',
      tenant_id: tenantId,
      barber_id: tenantId,
      status: connection?.status || 'disconnected'
    };

    try {
      const { data: saved, error } = connection?.id 
        ? await supabase.from("whatsapp_instances").update(upsertData).eq("id", connection.id).select().single()
        : await supabase.from("whatsapp_instances").insert([upsertData]).select().single();

      if (error) throw error;

      await supabase.from("barbershop_settings").upsert({
        barber_id: tenantId,
        instance_id: instanceId,
        instance_token: instanceToken,
        client_token: clientToken,
        whatsapp_number: phone,
        server_url: cleanApiUrl
      } as any);

      setConnection(saved as any);
      setTempWebhookUrl(webhookUrl);
      toast.success("Configurações salvas e sincronizadas!");
      
      await setupWebhook(saved as any);
      await fetchConnection();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function setupWebhook(conn: WhatsAppInstance) {
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
      const { data, error } = await supabase.functions.invoke('zapi-api', {
        body: { 
          action: 'check-status', 
          connectionId: connection.id 
        }
      });

      if (error) throw error;
      
      if (data.connected === true) {
        toast.success("WhatsApp conectado com sucesso!");
        toast.info("Enviando mensagem de teste...");
        await sendTestMessage();
      } else {
        toast.error("WhatsApp desconectado na Z-API.");
      }

      await fetchConnection();
      await fetchLogs();
    } catch (err: any) {
      console.error("Erro ao testar conexão:", err);
      toast.error("Erro ao testar conexão: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsTesting(false);
    }
  }
  
  async function sendTestMessage() {
    if (!connection) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-cloud', {
        body: {
          user_id: tenantId,
          event_type: 'reminder',
          phone: connection.phone || "5571999999999",
          placeholders: {
            cliente: "Teste BarberLM",
            horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("Mensagem de teste enviada!");
        await fetchLogs();
      } else {
        toast.error("Erro ao enviar: " + (data.error || "Erro na API"));
      }
    } catch (err: any) {
      console.error("Erro ao testar envio:", err);
      toast.error("Erro ao testar envio");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleDeleteWebhook() {
    if (!connection?.id || !confirm("Deseja realmente excluir este webhook?")) return;
    
    try {
      await supabase
        .from('whatsapp_instances')
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
        .from('whatsapp_instances')
        .update({ webhook_url: tempWebhookUrl })
        .eq('id', connection.id);
      
      setConnection({ ...connection, webhook_url: tempWebhookUrl });
      setIsEditingWebhook(false);
      toast.success("Webhook atualizado");
      
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
                <CardTitle className="text-xl font-bold tracking-tight">Z-API WhatsApp</CardTitle>
                <CardDescription className="text-slate-400">Instância oficial da barbearia para automações</CardDescription>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-6 border-b border-white/5 bg-black/20">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Última Sincronização</span>
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <History size={12} className="text-blue-500/60" />
              {connection?.updated_at ? new Date(connection.updated_at).toLocaleString('pt-BR') : 'Nunca'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Último Envio</span>
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <MessageSquare size={12} className="text-emerald-500/60" />
              {logs.length > 0 ? new Date(logs[0].created_at).toLocaleString('pt-BR') : 'Nenhum'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Telefone da Instância</span>
            <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
              <Phone size={12} className="text-blue-400/60" />
              {connection?.phone || 'Não configurado'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Servidor</span>
            <span className="text-xs text-slate-300 truncate">{connection?.server_url || '---'}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 border-b border-white/5">
            <TabsList className="bg-transparent h-12 gap-6 p-0">
              <TabsTrigger 
                value="config" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-2 h-full h-full text-slate-400 transition-all font-medium"
              >
                Configuração
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-2 h-full text-slate-400 transition-all font-medium"
              >
                Logs de Atividade
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="config" className="p-0 m-0">
            <CardContent className="space-y-8 pt-6">
              <form onSubmit={saveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Telefone da instância WhatsApp</Label>
                    <div className="relative">
                      <Input 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="5571999999999"
                        className={cn(
                          "bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11 pl-10",
                          formData.phone && formData.phone.replace(/\D/g, "").length < 12 && "border-red-500/50"
                        )} 
                        required 
                      />
                      <Phone className="absolute left-3 top-3 text-slate-500" size={18} />
                    </div>
                    <p className="text-[10px] text-slate-500">Formato: 55 + DDD + Número (apenas números)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">ID da Instância</Label>
                    <Input 
                      value={formData.instance_id}
                      onChange={(e) => setFormData({...formData, instance_id: e.target.value})}
                      placeholder="EX: 3B..."
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Token da Instância</Label>
                    <Input 
                      value={formData.instance_token}
                      onChange={(e) => setFormData({...formData, instance_token: e.target.value})}
                      type="password" 
                      placeholder="Seu token Z-API"
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Client Token (Opcional)</Label>
                    <Input 
                      value={formData.client_token}
                      onChange={(e) => setFormData({...formData, client_token: e.target.value})}
                      type="password" 
                      placeholder="Client Token da Z-API"
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11" 
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-300 text-sm font-medium">API da Instância (URL Base)</Label>
                    <Input 
                      value={formData.api_url}
                      onChange={(e) => setFormData({...formData, api_url: e.target.value})}
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 transition-all h-11"
                      placeholder="https://api.z-api.io"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button type="submit" disabled={isSaving} className="flex-1 bg-white text-black hover:bg-slate-200 h-11 font-semibold">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                    Salvar e Sincronizar
                  </Button>
                  {connection?.id && (
                    <>
                      <Button 
                        type="button" 
                        onClick={syncInstanceData} 
                        disabled={isTesting}
                        className="flex-1 bg-slate-800 text-white hover:bg-slate-700 h-11 font-semibold"
                      >
                        {isTesting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
                        Sincronizar Dados
                      </Button>
                      <Button 
                        type="button" 
                        onClick={testConnection} 
                        disabled={isTesting}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-11 font-semibold"
                      >
                        {isTesting ? <Loader2 className="animate-spin mr-2" /> : <MessageSquare size={18} className="mr-2" />}
                        Validar e Enviar Teste
                      </Button>
                    </>
                  )}
                </div>
              </form>

              {connection?.id && !isConnected && (
                <div className="space-y-4 pt-6 border-t border-white/10 flex flex-col items-center justify-center text-center">
                  <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20 max-w-md">
                    <AlertCircle className="text-red-400 h-10 w-10 mx-auto mb-4" />
                    <h3 className="font-bold text-white mb-2">WhatsApp Desconectado</h3>
                    <p className="text-sm text-slate-400">
                      Sua instância Z-API está desconectada. Escaneie o QR Code no painel Z-API e depois sincronize aqui.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={syncInstanceData} 
                      disabled={isTesting}
                      className="mt-6 bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                      <RefreshCw size={14} className={cn("mr-2", isTesting && "animate-spin")} />
                      Sincronizar Agora
                    </Button>
                  </div>
                </div>
              )}

              {connection?.id && (
                <div className="space-y-4 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-blue-400 h-5 w-5" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                        Webhook de Recebimento
                      </h3>
                    </div>
                  </div>
                  
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 font-mono text-xs text-blue-400/80 truncate">
                        {isEditingWebhook ? (
                          <Input 
                            value={tempWebhookUrl}
                            onChange={(e) => setTempWebhookUrl(e.target.value)}
                            className="bg-white/5 border-white/10 h-8 text-xs"
                          />
                        ) : (
                          connection.webhook_url || "Nenhum configurado"
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingWebhook ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400" onClick={handleUpdateWebhook}>
                              <CheckCircle2 size={16} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => setIsEditingWebhook(false)}>
                              <Trash2 size={16} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => connection.webhook_url && copyToClipboard(connection.webhook_url)}>
                              <Copy size={16} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setIsEditingWebhook(true)}>
                              <Edit3 size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </TabsContent>

          <TabsContent value="logs" className="p-0 m-0">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <FileText className="h-12 w-12 mb-4 opacity-20" />
                    <p>Nenhum log de atividade encontrado</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          log.status === 'success' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        )}>
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{log.message_type === 'birthday' ? 'Parabéns' : 'Lembrete de Agendamento'}</div>
                          <div className="text-xs text-slate-400 font-mono">{log.phone}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-xs font-bold uppercase tracking-wider mb-1",
                          log.status === 'success' ? "text-emerald-400" : "text-red-400"
                        )}>
                          {log.status === 'success' ? 'Enviado' : 'Erro'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
