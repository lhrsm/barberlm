
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
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[#1f2937]/50 bg-[#0b0f17]/50 p-6">
          <CardTitle className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
            <MessageSquare className="text-[#ea580c]" />
            Z-API WhatsApp
          </CardTitle>
          <CardDescription className="text-slate-400">
            Gerencie suas instâncias do WhatsApp via Z-API com tecnologia premium.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-4 bg-[#05070d] border border-[#1f2937] rounded-2xl hover:border-[#ea580c]/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#ea580c]/10 rounded-xl">
                  <MessageSquare className="text-[#ea580c] h-5 w-5" />
                </div>
                <div>
                  <p className="font-black italic uppercase tracking-tight text-white">{conn.phone || "Número Principal"}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ID: {conn.instance_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black uppercase text-[10px] tracking-widest italic px-3">
                  Conectado
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all" 
                  onClick={() => handleDeleteConnection(conn.id)}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))}
          {connections.length === 0 && (
            <div className="text-center py-10 bg-[#05070d]/50 rounded-2xl border border-dashed border-[#1f2937]">
              <Info className="h-10 w-10 text-slate-800 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">Nenhuma instância conectada.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="bg-[#0b0f17] border border-[#1f2937] p-1 rounded-2xl">
          <TabsTrigger value="templates" className="flex-1 rounded-xl data-[state=active]:bg-[#ea580c] data-[state=active]:text-black font-black uppercase tracking-widest text-[10px] italic h-10">Templates</TabsTrigger>
          <TabsTrigger value="logs" className="flex-1 rounded-xl data-[state=active]:bg-[#ea580c] data-[state=active]:text-black font-black uppercase tracking-widest text-[10px] italic h-10">Mensagens</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="pt-2 animate-in fade-in slide-in-from-top-4">
          <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['appointment_confirmation', 'reminder', 'cancellation', 'cashback'].map(type => (
                  <div key={type} className="space-y-3 p-5 bg-[#05070d] border border-[#1f2937] rounded-2xl hover:border-[#ea580c]/20 transition-all">
                    <Label className="font-black uppercase italic tracking-widest text-[#ea580c] text-[10px]">{type.replace('_', ' ')}</Label>
                    <Textarea 
                      value={getTemplateContent(type)}
                      onChange={e => saveTemplate(type, e.target.value)}
                      className="bg-[#0b0f17] border-[#1f2937] text-white focus:border-[#ea580c] min-h-[120px] rounded-xl resize-none font-medium text-sm leading-relaxed"
                    />
                    <div className="flex justify-end">
                       <Button size="sm" variant="ghost" className="text-[#ea580c] hover:bg-[#ea580c]/10 text-[10px] font-black uppercase tracking-widest">
                          <History size={12} className="mr-1" /> Ver Histórico
                       </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="pt-2 animate-in fade-in slide-in-from-top-4">
          <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] shadow-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-2 divide-y divide-[#1f2937]/30">
                {messages.length > 0 ? messages.map(msg => (
                  <div key={msg.id} className="py-4 flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-[#ea580c]/5 rounded-lg flex items-center justify-center">
                        <Send size={14} className="text-[#ea580c]" />
                      </div>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors truncate max-w-[200px] sm:max-w-md">{msg.content}</span>
                    </div>
                    <Badge variant="outline" className="font-black uppercase text-[8px] tracking-widest border-[#1f2937] text-slate-500">
                      {msg.status}
                    </Badge>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-slate-600 font-bold uppercase text-[10px] tracking-[0.2em]">Nenhuma mensagem registrada.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
