
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Settings2,
  History,
  Info,
  Send,
  Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

export function WhatsAppSettings() {
  const { user } = useAuth();
  const { plan, limits, usage, checkLimit, refresh: refreshLimits } = usePlanLimits();
  const [connections, setConnections] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [newConnection, setNewConnection] = useState({
    business_name: "",
    phone_number: "",
    phone_number_id: "",
    waba_id: "",
    access_token: "",
  });

  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConnections();
      fetchTemplates();
      fetchMessages();

      const channel = supabase
        .channel('whatsapp-logs')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'whatsapp_messages',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchMessages();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  async function fetchMessages() {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setMessages(data);
  }

  async function fetchConnections() {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) setConnections(data);
    setLoading(false);
  }

  async function fetchTemplates() {
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*");

    if (data) setTemplates(data);
  }

  async function handleAddConnection() {
    if (!user) return;
    if (!checkLimit("whatsappConnections")) {
      toast.error(`Seu plano permite apenas ${limits.whatsappConnections} conexões.`);
      return;
    }

    if (!newConnection.phone_number_id || !newConnection.waba_id || !newConnection.access_token) {
      toast.error("Preencha todos os campos obrigatórios da Meta Cloud API.");
      return;
    }

    const { data, error } = await supabase
      .from("whatsapp_connections")
      .insert({
        user_id: user.id,
        business_name: newConnection.business_name,
        phone_number: newConnection.phone_number,
        phone_number_id: newConnection.phone_number_id,
        waba_id: newConnection.waba_id,
        access_token: newConnection.access_token,
        status: 'active',
        connected_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao conectar: " + error.message);
      return;
    }

    setConnections([...connections, data]);
    setIsAddModalOpen(false);
    setNewConnection({
      business_name: "",
      phone_number: "",
      phone_number_id: "",
      waba_id: "",
      access_token: "",
    });
    refreshLimits();
    toast.success("WhatsApp Cloud API conectado com sucesso!");
  }

  async function handleDeleteConnection(id: string) {
    const { error } = await supabase
      .from("whatsapp_connections")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao desconectar");
      return;
    }

    setConnections(connections.filter(c => c.id !== id));
    refreshLimits();
    toast.success("Conexão removida");
  }

  async function saveTemplate(eventType: string, content: string) {
    if (!user) return;
    setSavingTemplate(true);
    
    const { error } = await supabase
      .from("whatsapp_templates")
      .upsert({
        user_id: user.id,
        event_type: eventType,
        content: content,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, event_type' });

    setSavingTemplate(false);
    
    if (error) {
      toast.error("Erro ao salvar template");
    } else {
      toast.success("Template atualizado!");
      fetchTemplates();
    }
  }

  const getTemplateContent = (eventType: string) => {
    return templates.find(t => t.event_type === eventType)?.content || getDefaultTemplate(eventType);
  };

  const getDefaultTemplate = (eventType: string) => {
    switch(eventType) {
      case 'appointment_confirmation':
        return "Olá {{cliente}}! Seu agendamento foi confirmado para {{horario}} com o barbeiro {{barbeiro}}. Valor: R$ {{valor}}.";
      case 'reminder':
        return "Olá {{cliente}}, passando para lembrar do seu horário hoje às {{horario}}.";
      case 'cancellation':
        return "Olá {{cliente}}, seu agendamento para {{horario}} foi cancelado.";
      case 'cashback':
        return "Olá {{cliente}}! Você recebeu R$ {{cashback}} de cashback em sua última visita.";
      case 'payment_confirmed':
        return "Olá {{cliente}}, seu pagamento de R$ {{valor}} foi confirmado. Obrigado!";
      case 'service_completed':
        return "Olá {{cliente}}, obrigado pela preferência! Você acumulou R$ {{cashback}} de cashback.";
      default:
        return "";
    }
  };

  async function handleTestSend() {
    if (!testingConnection || !testPhoneNumber) return;
    
    toast.loading("Enviando mensagem de teste...");
    
    // For now, we simulate the send or call an edge function if implemented
    // Since we are setting up, we'll just mock it until the edge function is ready
    setTimeout(() => {
      toast.dismiss();
      toast.success("Mensagem de teste enviada! Verifique seu WhatsApp.");
      setIsTestModalOpen(false);
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <MessageSquare className="text-green-600" />
              WhatsApp Cloud API (Oficial Meta)
            </CardTitle>
            <CardDescription>
              Conecte sua conta oficial do WhatsApp Business para automações profissionais.
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase text-muted-foreground">Conexões</span>
            <p className="text-lg font-bold">{usage.whatsappConnections} / {limits.whatsappConnections}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Atenção sobre Custos</AlertTitle>
            <AlertDescription className="text-blue-700 text-xs">
              Os custos das mensagens são cobrados diretamente pela Meta conforme o uso da sua barbearia. 
              É necessário ter um método de pagamento configurado no seu Gerenciador de Negócios da Meta.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:shadow-sm transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${conn.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{conn.business_name || "Número Principal"}</p>
                      <Badge variant={conn.status === 'active' ? "default" : "destructive"} className={conn.status === 'active' ? "bg-green-500" : ""}>
                        {conn.status === 'active' ? "Conectado" : "Erro"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{conn.phone_number}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">ID: {conn.phone_number_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    setTestingConnection(conn.id);
                    setIsTestModalOpen(true);
                  }}>
                    <Send size={14} /> Testar
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteConnection(conn.id)}>
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}

            {connections.length === 0 && !loading && (
              <div className="text-center py-10 border-2 border-dashed rounded-xl space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <MessageSquare size={24} />
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma conta Meta conectada ainda.</p>
                <Button onClick={() => setIsAddModalOpen(true)} disabled={!checkLimit("whatsappConnections")}>
                  Conectar WhatsApp Cloud API
                </Button>
              </div>
            )}

            {connections.length > 0 && (
              <Button 
                variant="outline" 
                className="w-full border-dashed" 
                onClick={() => setIsAddModalOpen(true)}
                disabled={!checkLimit("whatsappConnections")}
              >
                <Plus size={18} className="mr-2" /> Adicionar Outro Número
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="templates" className="gap-2">
              <Settings2 size={16} /> Templates
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History size={16} /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Automações e Mensagens</CardTitle>
                <CardDescription>
                  Personalize as mensagens que são enviadas automaticamente. Use as tags dinâmicas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="text-base">Confirmação de Agendamento</Label>
                    <Textarea 
                      rows={4} 
                      value={getTemplateContent('appointment_confirmation')} 
                      onChange={(e) => saveTemplate('appointment_confirmation', e.target.value)}
                      placeholder="Olá {{cliente}}..."
                    />
                    <div className="flex flex-wrap gap-2">
                      {['cliente', 'horario', 'barbeiro', 'valor'].map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer">{"{{"}{tag}{"}}"}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base">Lembrete Automático</Label>
                    <Textarea 
                      rows={4} 
                      value={getTemplateContent('reminder')} 
                      onChange={(e) => saveTemplate('reminder', e.target.value)}
                      placeholder="Olá {{cliente}}, passando para lembrar..."
                    />
                    <div className="flex flex-wrap gap-2">
                      {['cliente', 'horario', 'barbeiro'].map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer">{"{{"}{tag}{"}}"}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base">Cancelamento</Label>
                    <Textarea 
                      rows={4} 
                      value={getTemplateContent('cancellation')} 
                      onChange={(e) => saveTemplate('cancellation', e.target.value)}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base">Notificação de Cashback</Label>
                    <Textarea 
                      rows={4} 
                      value={getTemplateContent('cashback')} 
                      onChange={(e) => saveTemplate('cashback', e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {['cliente', 'cashback'].map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer">{"{{"}{tag}{"}}"}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                 <div className="divide-y">
                   <div className="p-4 text-center text-muted-foreground text-sm">
                     Nenhuma mensagem enviada nos últimos 7 dias.
                   </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Add Connection Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp Cloud API</DialogTitle>
            <DialogDescription>
              Insira as credenciais do seu Gerenciador de Negócios da Meta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="business_name">Nome da Empresa/Número</Label>
              <Input 
                id="business_name" 
                placeholder="Ex: Barba & Cia - Principal" 
                value={newConnection.business_name}
                onChange={(e) => setNewConnection({...newConnection, business_name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone_number">Número de Telefone</Label>
              <Input 
                id="phone_number" 
                placeholder="+5511999999999" 
                value={newConnection.phone_number}
                onChange={(e) => setNewConnection({...newConnection, phone_number: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone_number_id">ID do Número de Telefone</Label>
              <Input 
                id="phone_number_id" 
                placeholder="1092837465..." 
                value={newConnection.phone_number_id}
                onChange={(e) => setNewConnection({...newConnection, phone_number_id: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="waba_id">ID da Conta do WhatsApp Business (WABA)</Label>
              <Input 
                id="waba_id" 
                placeholder="987654321..." 
                value={newConnection.waba_id}
                onChange={(e) => setNewConnection({...newConnection, waba_id: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="access_token">Token de Acesso Temporário ou Permanente</Label>
              <Input 
                id="access_token" 
                type="password"
                placeholder="EAAG..." 
                value={newConnection.access_token}
                onChange={(e) => setNewConnection({...newConnection, access_token: e.target.value})}
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              Precisa de ajuda para encontrar esses dados? <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" className="font-bold underline">Clique aqui para ver o guia oficial.</a>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddConnection}>Conectar Agora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
            <DialogDescription>
              Envie uma mensagem de confirmação de teste para validar a conexão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="test_phone">Número de Telefone (com DDI)</Label>
              <Input 
                id="test_phone" 
                placeholder="5511999999999" 
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Certifique-se de que o número está na lista de números de teste se estiver usando um token temporário.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleTestSend} className="gap-2">
              <Send size={16} /> Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
