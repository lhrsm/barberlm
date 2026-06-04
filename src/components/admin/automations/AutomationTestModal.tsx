import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Info, Zap, Play, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



interface AutomationTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  automation: any;
}

export function AutomationTestModal({
  isOpen,
  onClose,
  automation,
}: AutomationTestModalProps) {
  const [phone, setPhone] = useState("");
  const [testType, setTestType] = useState("fictitious");
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realData, setRealData] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [lastTestResult, setLastTestResult] = useState<any>(null);
  const [isLoadingLastTest, setIsLoadingLastTest] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);



  const fetchRealData = async (appointmentId?: string) => {
    setIsLoadingRealData(true);
    try {
      // 1. Fetch recent appointments
      const { data: appointments, error: appError } = await (supabase as any)
        .from("appointments")
        .select(`
          id, 
          start_time, 
          customer_id, 
          service_id, 
          barber_id,
          total_price,
          customer:customers(name, phone)
        `)
        .eq("tenant_id", automation.tenant_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (appError) throw appError;

      if (appointments && appointments.length > 0) {
        setRecentAppointments(appointments);
        
        // Use provided ID or the latest one
        const targetId = appointmentId || appointments[0].id;
        const appointment = appointments.find((a: any) => a.id === targetId) || appointments[0];
        
        setSelectedAppointmentId(appointment.id);

        // Fetch remaining details for the selected one
        const { data: service } = await (supabase as any)
          .from("services")
          .select("name, price")
          .eq("id", appointment.service_id)
          .maybeSingle();

        const { data: professional } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", appointment.barber_id)
          .maybeSingle();

        const { data: tenant } = await (supabase as any)
          .from("tenants")
          .select("name")
          .eq("id", automation.tenant_id)
          .maybeSingle();

        setRealData({
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: tenant?.name || "Barbearia",
          service_name: service?.name || "Serviço",
          professional_name: professional?.full_name || "Profissional",
          appointment_date: appointment.start_time ? new Date(appointment.start_time).toLocaleDateString("pt-BR") : "--/--/----",
          appointment_time: appointment.start_time ? new Date(appointment.start_time).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }) : "--:--",
          service_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appointment.total_price || service?.price || 0),
        });
      } else {
        setRecentAppointments([]);
        setRealData(null);
        setSelectedAppointmentId("");
      }

    } catch (error: any) {
      console.error("Error fetching real data:", error);
      toast.error("Erro ao carregar agendamento: " + error.message);
    } finally {
      setIsLoadingRealData(false);
    }
  };


  const fetchLastTestResult = async () => {
    setIsLoadingLastTest(true);
    try {
      const { data, error } = await (supabase as any)
        .from("automation_logs")
        .select("*")
        .eq("automation_id", automation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLastTestResult(data);
    } catch (error) {
      console.error("Error fetching last test:", error);
    } finally {
      setIsLoadingLastTest(false);
    }
  };


  useEffect(() => {
    if (isOpen) {
      fetchLastTestResult();
      if (testType === "real") {
        fetchRealData();
      }
    }
  }, [isOpen, testType]);


  const getTestData = () => {
    if (testType === "real") return realData;
    
    return {
      customer_name: "João Silva (Teste)",
      barbershop_name: "Barbex Premium",
      service_name: "Corte + Barba",
      professional_name: "Carlos (Barbeiro)",
      appointment_date: new Date().toLocaleDateString("pt-BR"),
      appointment_time: "14:30",
      service_price: "R$ 80,00",
    };
  };

  const testData = getTestData();

  const replaceVariables = (template: string, data: any) => {
    if (!template || !data) return template;
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value as string);
    });
    return result;
  };

  const renderedTemplate = replaceVariables(automation?.template || "", testData);

  const handleSimulateTrigger = async () => {
    if (!selectedAppointmentId) {
      toast.error("Nenhum agendamento selecionado.");
      return;
    }

    setIsSimulating(true);
    try {
      // Manual trigger by inserting event
      const { error } = await (supabase as any).from("automation_events").insert({
        tenant_id: automation.tenant_id,
        event_name: 'appointment.created',
        entity_type: 'appointment',
        entity_id: selectedAppointmentId,
        payload: { 
          simulation: true, 
          triggered_by: 'manual_test',
          appointment_id: selectedAppointmentId
        }
      });

      if (error) {
        // Fallback to direct queue insert if automation_events fails
        const { error: queueError } = await (supabase as any).from("automation_queue").insert({
          tenant_id: automation.tenant_id,
          automation_id: automation.id,
          appointment_id: selectedAppointmentId,
          status: 'pending'
        });
        if (queueError) throw queueError;
      }

      toast.success("Evento simulado! Tarefa enfileirada com sucesso.");
      fetchLastTestResult();
    } catch (error: any) {
      toast.error("Erro ao simular: " + error.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTest = async () => {

    if (!phone) {
      toast.error("Informe um telefone de destino");
      return;
    }

    if (testType === "real" && !realData) {
      toast.error("Nenhum agendamento encontrado para teste");
      return;
    }

    setIsTesting(true);
    try {
      // 1. Phone validation
      if (phone.length < 10) {
        throw new Error("Telefone inválido. Use o formato DDI + DDD + Número (Ex: 5511999999999)");
      }

      // 2. Template rendering validation
      if (!renderedTemplate) {
        throw new Error("Erro ao renderizar o template. Verifique as variáveis.");
      }

      // 3. Instance check
      const { data: instance, error: instError } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('tenant_id', automation.tenant_id)
        .single();

      if (instError || !instance) {
        throw new Error("Instância do WhatsApp não encontrada para este tenant.");
      }

      // Call the zapi-api edge function
      const { data: zapiData, error: zapiError } = await supabase.functions.invoke('zapi-api', {
        body: {
          action: 'send-test-message',
          instanceId: instance.id,
          data: {
            phone: phone,
            message: renderedTemplate
          }
        }
      });

      if (zapiError) throw zapiError;

      const isSuccess = zapiData?.success === true;

      const { data: newLog } = await (supabase as any).from("automation_logs").insert({
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        phone: phone,
        status: isSuccess ? "sent" : "error",
        message_type: automation.key,
        processed_template: renderedTemplate,
        original_template: automation.template,
        provider: "zapi",
        sent_at: new Date().toISOString(),
        payload: { test_data: testData, rendered: renderedTemplate, test_type: testType, is_test: true },
        error_message: isSuccess ? null : (zapiData?.error || "Erro no envio de teste"),
        response: zapiData?.result
      }).select().single();

      if (isSuccess) {
        toast.success("Teste enviado com sucesso!");
        setLastTestResult(newLog);
        // Não fechar imediatamente para permitir ver o resultado
      } else {
        throw new Error(zapiData?.error || "Falha ao enviar mensagem pelo provedor.");
      }
    } catch (error: any) {
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Falha no Teste</p>
          <p className="text-xs">{error.message}</p>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-[10px] mt-1 border-white/20 hover:bg-white/10"
            onClick={handleTest}
          >
            <RefreshCcw size={10} className="mr-1" /> Tentar novamente
          </Button>
        </div>,
        { duration: 5000 }
      );
    } finally {
      setIsTesting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#020817] border-amber-500/20 text-white p-0 overflow-hidden rounded-[24px]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Testar Automação
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 space-y-6 overflow-y-auto max-h-[80vh]">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-400 text-xs font-bold uppercase tracking-wider">Telefone de destino</Label>
            <Input
              id="phone"
              placeholder="Ex: 5511999999999"
              className="bg-[#0F172A] border-slate-800 text-white rounded-xl h-11 focus:border-amber-500/50"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Origem dos dados</Label>
            <RadioGroup value={testType} onValueChange={setTestType} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                htmlFor="fictitious"
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  testType === "fictitious" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                }`}
              >
                <RadioGroupItem value="fictitious" id="fictitious" className="border-amber-500" />
                <span className="text-sm font-medium">Dados fictícios</span>
              </label>
              
              <label 
                htmlFor="real"
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  testType === "real" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                }`}
              >
                <RadioGroupItem value="real" id="real" className="border-amber-500" />
                <span className="text-sm font-medium flex items-center gap-2">
                  Agendamento real
                  {isLoadingRealData && <Loader2 size={12} className="animate-spin text-amber-500" />}
                </span>
              </label>
            </RadioGroup>
          </div>

          {testType === "real" && recentAppointments.length > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Escolher Agendamento</Label>
              <Select 
                value={selectedAppointmentId} 
                onValueChange={(val) => fetchRealData(val)}
              >
                <SelectTrigger className="bg-[#0F172A] border-slate-800 text-white rounded-xl h-11 focus:border-amber-500/50 focus:ring-amber-500/50">
                  <SelectValue placeholder="Selecione um agendamento" />
                </SelectTrigger>
                <SelectContent className="bg-[#0F172A] border-slate-800 text-white">
                  {recentAppointments.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      <div className="flex flex-col">
                        <span className="font-bold">{app.customer?.name || 'Cliente'}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(app.start_time).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Preview da mensagem</Label>
            <div className="bg-[#0F172A] border border-amber-500/20 p-4 rounded-2xl relative min-h-[100px]">
              {testType === "real" && !isLoadingRealData && !realData ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="text-amber-500" size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-500">Nenhum agendamento encontrado para teste.</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                      Crie um agendamento real na plataforma antes de testar com esta opção.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <div className={`text-sm whitespace-pre-wrap leading-relaxed flex-1 ${isLoadingRealData ? "opacity-20" : "text-slate-200"}`}>
                      {renderedTemplate}
                    </div>
                    {testType === "real" && !isLoadingRealData && realData && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-[9px] text-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-900 rounded-lg shrink-0 ml-2 focus-visible:ring-2 focus-visible:ring-amber-500"
                        onClick={handleSimulateTrigger}
                        disabled={isSimulating}
                      >
                        {isSimulating ? <Loader2 size={10} className="animate-spin mr-1" /> : <Zap size={10} className="mr-1" />}
                        Simular Gatilho
                      </Button>
                    )}
                  </div>

                  {isLoadingRealData && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-amber-500" size={24} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>


          {/* Resumo do Último Teste */}
          {lastTestResult && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Último resultado</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(lastTestResult.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {lastTestResult.status === 'sent' ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[10px] flex items-center gap-1">
                    <CheckCircle2 size={10} /> Sucesso
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/10 text-rose-500 border-none text-[10px] flex items-center gap-1">
                    <XCircle size={10} /> Falha
                  </Badge>
                )}
                <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                  Para: {lastTestResult.phone}
                </span>
              </div>
              {lastTestResult.error_message && (
                <p className="text-[10px] text-rose-400/80 italic line-clamp-1">
                  Erro: {lastTestResult.error_message}
                </p>
              )}
            </div>
          )}

        </div>

        <DialogFooter className="p-6 bg-[#0F172A]/80 border-t border-white/5 flex flex-col-reverse sm:flex-row gap-4 sm:gap-4 mt-auto">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isTesting} 
            className="w-full sm:flex-1 h-14 rounded-2xl font-semibold bg-white text-[#0F172A] border-2 border-[#E5E7EB] shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] hover:-translate-y-0.5 active:translate-y-0 active:bg-[#E2E8F0] transition-all duration-250 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleTest} 
            disabled={isTesting || (testType === "real" && !realData) || isLoadingRealData}
            className="w-full sm:flex-[1.5] h-14 rounded-2xl font-bold bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white border-none shadow-[0_8px_25px_rgba(245,158,11,0.35)] hover:from-[#FBBF24] hover:to-[#F59E0B] hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(245,158,11,0.45)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(245,158,11,0.25)] transition-all duration-250 cursor-pointer disabled:bg-[#374151] disabled:text-[#9CA3AF] disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 disabled:bg-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            {isTesting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={18} />
                Enviar Teste
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
