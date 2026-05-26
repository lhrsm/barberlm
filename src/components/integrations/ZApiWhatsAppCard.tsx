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
  connected?: boolean;
}

export function ZApiWhatsAppCard({ tenantId }: { tenantId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
    }
  }, [tenantId]);

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
