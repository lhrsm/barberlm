
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
  Save,
  BookOpen
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

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
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  
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
      fetchAutomationLogs();
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

  async function fetchAutomationLogs() {
    const { data } = await supabase
      .from("automation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setAutomationLogs(data);
  }

  async function fetchConnections() {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_instances")
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

  async function handleDeleteConnection(id: string) {
    const { error } = await supabase
      .from("whatsapp_instances")
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

  return (
    <div className="space-y-6">
      <Card className="bg-white border-2 border-slate-200 text-black shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="text-blue-600" />
            Z-API WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie suas instâncias do WhatsApp via Z-API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-4 border rounded-xl">
              <div>
                <p className="font-bold">{conn.phone || "Número Principal"}</p>
                <p className="text-xs text-muted-foreground">ID: {conn.instance_id}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteConnection(conn.id)}>
                <Trash2 size={18} />
              </Button>
            </div>
          ))}
          {connections.length === 0 && <p className="text-center text-slate-500 py-4">Nenhuma instância conectada.</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Mensagens</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="pt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['appointment_confirmation', 'reminder', 'cancellation', 'cashback'].map(type => (
                  <div key={type} className="space-y-2">
                    <Label className="capitalize">{type.replace('_', ' ')}</Label>
                    <Textarea 
                      value={getTemplateContent(type)}
                      onChange={e => saveTemplate(type, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs">
          <Card>
            <CardContent className="pt-6">
              <div className="divide-y">
                {messages.map(msg => (
                  <div key={msg.id} className="py-2 text-sm flex justify-between">
                    <span>{msg.content}</span>
                    <Badge variant="outline">{msg.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
