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
import { Loader2, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Info, Zap, Play, Calendar, Send, FileCode, Terminal, X, MessageSquare, ClipboardList } from "lucide-react";
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
  const [anniversarySubType, setAnniversarySubType] = useState("anniversary_day");
  const [reminderSubType, setReminderSubType] = useState("30m");
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realData, setRealData] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [lastTestResult, setLastTestResult] = useState<any>(null);
  const [isLoadingLastTest, setIsLoadingLastTest] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [debugPayload, setDebugPayload] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);




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

        // 3. Resolve Professional Name manually (Step by Step)
        let profName = "Profissional não encontrado";
        const profId = appointment.barber_id || appointment.professional_id;
        
        if (profId) {
            // Try barbers
            const { data: barberData } = await (supabase as any).from("barbers").select("name").eq("id", profId).maybeSingle();
            if (barberData?.name) {
                profName = barberData.name;
            } else {
                // Try profiles
                const { data: profileData } = await (supabase as any).from("profiles").select("full_name").eq("id", profId).maybeSingle();
                if (profileData?.full_name) profName = profileData.full_name;
            }
        }

        const { data: tenant } = await (supabase as any)
          .from("tenants")
          .select("name")
          .eq("id", automation.tenant_id)
          .maybeSingle();

        setRealData({
          customer_name: appointment.customer?.name || "Cliente",
          barbershop_name: tenant?.name || "Barbearia",
          service_name: service?.name || "Serviço",
          professional_name: profName,
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (e.key === 'Enter' && e.ctrlKey && isOpen && !isTesting && !isSimulating) {
        handleTest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTesting, isSimulating, phone, testType, realData]);

  useEffect(() => {
    if (isOpen) {
      fetchLastTestResult();
      if (testType === "real") {
        fetchRealData();
      }
      setDebugPayload(null);
      setShowDebug(false);
    }
  }, [isOpen, testType]);

  const fetchDebugPayload = async () => {
    if (!selectedAppointmentId && testType === "real") {
      toast.error("Selecione um agendamento para ver o payload.");
      return;
    }

    setIsLoadingDebug(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: { 
          tenant_id: automation.tenant_id, 
          appointment_id: selectedAppointmentId || recentAppointments[0]?.id,
          dry_run: true 
        }
      });

      if (error) throw error;
      if (data?.results?.[0]?.dry_run) {
        setDebugPayload(data.results[0].payload);
        setShowDebug(true);
      } else {
        throw new Error("Payload não retornado");
      }
    } catch (error: any) {
      console.error("Debug payload error:", error);
      toast.error("Erro ao carregar debug: " + error.message);
    } finally {
      setIsLoadingDebug(false);
    }
  };



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

  const getBaseTemplate = () => {
    if (automation?.key === 'barbershop_anniversary') {
      if (anniversarySubType === 'reminder_7_days') {
        return automation.additional_templates?.reminder_7_days || `Olá {customer_name} 👋\n\nO aniversário da {barbershop_name} está chegando! 🎉\n\nFaltam apenas 7 dias para celebrarmos mais um ano dessa história com você.\n\nPrepare-se, porque vem comemoração especial por aí! 💈`;
      }
      return automation.template || `Olá {customer_name} 🎉\n\nHoje é aniversário da {barbershop_name}! 💈\n\nE quem ganha presente é você.\n\nPara comemorar com a gente, você recebeu um cupom especial para usar em nossos produtos ou serviços na barbearia.\n\n🎁 Cupom: FESTEJE10\n\nAproveite hoje e venha celebrar esse momento com a gente!`;
    }
    
    if (automation?.key === 'appointment_reminder') {
      if (reminderSubType === '6h') {
        return `Olá {customer_name} 👋\n\nPassando para lembrar do seu agendamento na {barbershop_name}.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nEstamos te esperando!`;
      }
      if (reminderSubType === '1h') {
        return `Olá {customer_name} 👋\n\nSeu atendimento na {barbershop_name} está chegando.\n\n⏰ Falta apenas 1 hora para o seu agendamento.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n⏰ Horário: {appointment_time}`;
      }
      if (reminderSubType === '30m') {
        return `Olá {customer_name} 👋\n\nFaltam 30 minutos para o seu agendamento na {barbershop_name}.\n\n📋 Serviço: {service_name}\n💈 Profissional: {professional_name}\n⏰ Horário: {appointment_time}\n\nDeseja confirmar, reagendar ou cancelar?`;
      }
    }

    if (automation?.key === 'customer_birthday') {
      return automation.template || `Olá {customer_name} 🎉\n\nA {barbershop_name} te felicita pelo seu aniversário!\n\nQue seu dia seja especial e cheio de boas comemorações. 🥳\n\nE para comemorar com a gente, você ganhou um cupom especial para usar em nossos produtos ou serviços na barbearia.\n\n🎁 Cupom: ANIVERSARIO10\n\nEsperamos você para celebrar esse momento com estilo! 💈`;
    }

    if (automation?.key === 'appointment_confirmation') {
      return `Olá {customer_name} 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}`;
    }

    return automation?.template || "";
  };

  const renderedTemplate = replaceVariables(getBaseTemplate(), testData);

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
    if (!selectedAppointmentId && testType === "real") {
      toast.error("Selecione um agendamento para o teste.");
      return;
    }

    setIsTesting(true);
    const loadingToastId = toast.loading("Processando envio de teste...");

    try {
      if (testType === "fictitious") {
         if (!phone || phone.length < 10) {
            toast.error("Informe um telefone válido para o teste fictício.");
            return;
         }
         
          const { data: zapiData, error: zapiError } = await supabase.functions.invoke('zapi-api', {
            body: {
              action: 'send-test-message',
              instanceId: (await supabase.from('whatsapp_instances').select('id').eq('tenant_id', automation.tenant_id).single()).data?.id,
              data: { phone, message: renderedTemplate }
            }
          });
          
          if (zapiError || !zapiData?.success) throw new Error(zapiError?.message || zapiData?.error || "Erro no provedor");
          
          const providerMsgId = zapiData?.result?.messageId || zapiData?.result?.id;

          // Manual Dispatch V2 Record
          const requiresCallback = () => {
            if (automation?.key === 'barbershop_anniversary') return false;
            if (automation?.key === 'customer_birthday') return false;
            if (automation?.key === 'appointment_confirmation') return false;
            if (automation?.key === 'appointment_reminder') {
              return reminderSubType === '30m';
            }
            return automation.requires_callback || false;
          };

          await (supabase as any).from("automation_v2_dispatches").insert({
            tenant_id: automation.tenant_id,
            workflow_key: automation.key || 'test_manual',
            event_name: automation.trigger_event || 'test.manual',
            test_mode: true,
            flow_type: 'single',
            phone: phone,
            customer_phone: phone,
            customer_name: testData.customer_name,
            status: "sent",
            message_id: providerMsgId,
            provider_message_id: providerMsgId,
            sent_at: new Date().toISOString(),
            payload: { 
              test_data: testData, 
              rendered: renderedTemplate, 
              test_type: "fictitious",
              anniversary_message_type: anniversarySubType,
              reminder_type: reminderSubType
            },
            provider_response: zapiData?.result,
            callback_received: false,
            requires_callback: requiresCallback()
          });

          await (supabase as any).from("automation_logs").insert({
            automation_id: automation.id,
            tenant_id: automation.tenant_id,
            phone: phone,
            status: "success",
            message_type: "test_manual",
            processed_template: renderedTemplate,
            original_template: automation.template,
            provider: "zapi",
            sent_at: new Date().toISOString(),
            payload: { test_data: testData, rendered: renderedTemplate, test_type: "fictitious", origin: "test_manual", source: "test_manual" },
            response: zapiData?.result
          });

          toast.success("Teste fictício enviado!");
          return;
      }

      // Real appointment test
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: { 
          tenant_id: automation.tenant_id, 
          appointment_id: selectedAppointmentId || recentAppointments[0]?.id,
          automation_id: automation.id,
          force_resend: true,
          payload: {
            anniversary_message_type: anniversarySubType,
            reminder_type: reminderSubType
          }
        }
      });

      if (error) {
        throw new Error(`Edge Function Error: ${error.message}`);
      }

      if (data?.success) {
        const itemResult = data.results?.[0];
        if (itemResult?.success) {
           toast.success("Teste enviado com sucesso!");
           fetchLastTestResult();
        } else {
           throw new Error(itemResult?.error || data.message || "Falha no disparo");
        }
      } else {
        throw new Error(data?.error || "Falha no processamento da função");
      }
    } catch (error: any) {
      console.error("Test error detail:", error);
      toast.error(
        <div className="flex flex-col gap-1">
           <p className="font-bold">Falha no Teste</p>
           <p className="text-[10px] opacity-80">{error.message}</p>
        </div>,
        { duration: 6000 }
      );
    } finally {
      toast.dismiss(loadingToastId);
      setIsTesting(false);
    }
  };
  const handleTestCallback = async (text: string) => {
    if (!phone && testType === "fictitious") {
      toast.error("Informe o telefone usado no envio inicial.");
      return;
    }
    const targetPhone = testType === "real" ? realData?.customer_phone || recentAppointments.find(a => a.id === selectedAppointmentId)?.customer?.phone : phone;
    if (!targetPhone) {
      toast.error("Telefone não identificado.");
      return;
    }
    const loadingToastId = toast.loading(`Simulando resposta "${text}"...`);
    try {
      const { data: zapiData, error: zapiError } = await supabase.functions.invoke('zapi-api', {
        body: {
          action: 'test-received-callback',
          data: { phone: targetPhone, text }
        }
      });
      if (zapiError || !zapiData?.success) throw new Error(zapiError?.message || zapiData?.error || "Erro ao simular webhook");
      toast.success(`Resposta "${text}" simulada com sucesso!`, { id: loadingToastId });
    } catch (error: any) {
      console.error("Callback test error:", error);
      toast.error("Erro ao simular resposta: " + error.message, { id: loadingToastId });
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#020817] border-amber-500/20 text-white p-0 overflow-hidden rounded-[24px]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Testar Automação
            <Badge variant="outline" className="text-[10px] ml-auto font-normal text-slate-500 border-slate-800">
              Esc para fechar
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 space-y-6 overflow-y-auto max-h-[80vh]">
          {testType === "fictitious" && (
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
          )}

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

          {automation?.key === 'barbershop_anniversary' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tipo de Mensagem</Label>
              <RadioGroup value={anniversarySubType} onValueChange={setAnniversarySubType} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  htmlFor="reminder_7_days"
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    anniversarySubType === "reminder_7_days" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <RadioGroupItem value="reminder_7_days" id="reminder_7_days" className="border-amber-500" />
                  <span className="text-sm font-medium">7 dias antes</span>
                </label>
                
                <label 
                  htmlFor="anniversary_day"
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    anniversarySubType === "anniversary_day" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <RadioGroupItem value="anniversary_day" id="anniversary_day" className="border-amber-500" />
                  <span className="text-sm font-medium">No dia</span>
                </label>
              </RadioGroup>
            </div>
          )}

          {automation?.key === 'appointment_reminder' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Momento do Lembrete</Label>
              <RadioGroup value={reminderSubType} onValueChange={setReminderSubType} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label 
                  htmlFor="6h"
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    reminderSubType === "6h" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <RadioGroupItem value="6h" id="6h" className="border-amber-500" />
                  <span className="text-[10px] font-medium">6 horas</span>
                </label>
                
                <label 
                  htmlFor="1h"
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    reminderSubType === "1h" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <RadioGroupItem value="1h" id="1h" className="border-amber-500" />
                  <span className="text-[10px] font-medium">1 hora</span>
                </label>

                <label 
                  htmlFor="30m"
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    reminderSubType === "30m" ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <RadioGroupItem value="30m" id="30m" className="border-amber-500" />
                  <span className="text-[10px] font-medium">30 min</span>
                </label>
              </RadioGroup>
            </div>
          )}

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
                      <div className="flex gap-2 shrink-0 ml-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-[9px] text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
                          onClick={fetchDebugPayload}
                          disabled={isLoadingDebug}
                        >
                          {isLoadingDebug ? <Loader2 size={10} className="animate-spin mr-1" /> : <FileCode size={10} className="mr-1" />}
                          Debug Payload
                        </Button>

                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-[9px] text-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-900 rounded-lg focus-visible:ring-2 focus-visible:ring-amber-500"
                          onClick={handleSimulateTrigger}
                          disabled={isSimulating}
                        >
                          {isSimulating ? <Loader2 size={10} className="animate-spin mr-1" /> : <Zap size={10} className="mr-1" />}
                          Simular Gatilho
                        </Button>
                      </div>
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

            {showDebug && debugPayload && (
              <div className="mt-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Terminal size={12} />
                    Payload JSON (Dry Run)
                  </h4>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowDebug(false)}>
                    <X size={10} />
                  </Button>
                </div>
                <div className="bg-[#020617] rounded-xl p-4 border border-blue-500/20 max-h-[250px] overflow-auto">
                  <pre className="text-[10px] text-blue-300 font-mono">
                    {JSON.stringify(debugPayload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
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

        <div className="px-6 pb-6 space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Teste Fim-a-Fim (Simular Respostas)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-[10px] border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-500 rounded-lg flex-1"
                onClick={() => handleTestCallback("1")}
              >
                Simular "1"
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-[10px] border-amber-500/30 hover:bg-amber-500/10 text-amber-500 rounded-lg flex-1"
                onClick={() => handleTestCallback("2")}
              >
                Simular "2"
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-[10px] border-rose-500/30 hover:bg-rose-500/10 text-rose-500 rounded-lg flex-1"
                onClick={() => handleTestCallback("3")}
              >
                Simular "3"
              </Button>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-4">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isTesting} 
              className="w-full sm:flex-1 h-12 rounded-xl font-semibold bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleTest} 
              disabled={isTesting || (testType === "real" && !realData) || isLoadingRealData}
              className="w-full sm:flex-[1.5] h-12 rounded-xl font-bold bg-amber-500 text-slate-900 hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
            >
              {isTesting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Enviando...
                </span>
              ) : (
                <span className="flex flex-col items-center leading-tight">
                  <span>Enviar Teste Inicial</span>
                  <span className="text-[9px] opacity-70 font-normal">Ctrl + Enter</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
