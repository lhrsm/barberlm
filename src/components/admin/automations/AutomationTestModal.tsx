
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
import { Loader2, AlertCircle } from "lucide-react";

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

  const fetchRealData = async () => {
    setIsLoadingRealData(true);
    try {
      // 1. Fetch the last appointment for this tenant using any casting for flexible querying
      const { data: appointment, error: appError } = await (supabase as any)
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          customer:profiles!appointments_customer_id_fkey(full_name),
          professional:profiles!appointments_professional_id_fkey(full_name),
          service:services(name, price),
          barbershop:tenants(name)
        `)
        .eq("tenant_id", automation.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appError) throw appError;

      if (appointment) {
        setRealData({
          customer_name: (appointment.customer as any)?.full_name || "Cliente",
          barbershop_name: (appointment.barbershop as any)?.name || "Barbearia",
          service_name: (appointment.service as any)?.name || "Serviço",
          professional_name: (appointment.professional as any)?.full_name || "Profissional",
          appointment_date: appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString("pt-BR") : "--/--/----",
          appointment_time: appointment.appointment_time?.substring(0, 5) || "--:--",
          service_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((appointment.service as any)?.price || 0),
        });
      } else {
        setRealData(null);
      }
    } catch (error: any) {
      console.error("Error fetching real data:", error);
      toast.error("Erro ao carregar último agendamento: " + error.message);
    } finally {
      setIsLoadingRealData(false);
    }
  };

  useEffect(() => {
    if (isOpen && testType === "real") {
      fetchRealData();
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
      // Call the zapi-api edge function
      const { data: zapiData, error: zapiError } = await supabase.functions.invoke('zapi-api', {
        body: {
          action: 'send-test-message',
          instanceId: (await supabase.from('whatsapp_instances').select('id').eq('tenant_id', automation.tenant_id).single()).data?.id,
          data: {
            phone: phone,
            message: renderedTemplate
          }
        }
      });

      if (zapiError) throw zapiError;

      const isSuccess = zapiData?.success === true;

      await (supabase as any).from("automation_logs").insert({
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        phone: phone,
        status: isSuccess ? "sent" : "error",
        message_type: automation.key,
        processed_template: renderedTemplate,
        original_template: automation.template,
        provider: "zapi",
        sent_at: new Date().toISOString(),
        payload: { test_data: testData, rendered: renderedTemplate, test_type: testType },
        error_message: isSuccess ? null : (zapiData?.error || "Erro no envio de teste"),
        response: zapiData?.result
      });

      if (isSuccess) {
        toast.success("Teste enviado com sucesso!");
        onClose();
      } else {
        throw new Error(zapiData?.error || "Falha ao enviar mensagem");
      }
    } catch (error: any) {
      toast.error("Erro ao enviar teste: " + error.message);
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

          <div className="space-y-3">
            <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Preview da mensagem</Label>
            <div className="bg-[#0F172A] border border-amber-500/20 p-4 rounded-2xl relative min-h-[100px]">
              {testType === "real" && !isLoadingRealData && !realData ? (
                <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
                  <AlertCircle className="text-amber-500" size={24} />
                  <p className="text-sm font-bold text-amber-500">Nenhum agendamento encontrado para teste.</p>
                  <p className="text-[10px] text-slate-500">Crie um agendamento na plataforma para testar com dados reais.</p>
                </div>
              ) : (
                <>
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isLoadingRealData ? "opacity-20" : "text-slate-200"}`}>
                    {renderedTemplate}
                  </p>
                  {isLoadingRealData && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-amber-500" size={24} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-900/50">
          <Button variant="ghost" onClick={onClose} disabled={isTesting} className="text-slate-400 hover:text-white">
            Cancelar
          </Button>
          <Button 
            onClick={handleTest} 
            disabled={isTesting || (testType === "real" && !realData) || isLoadingRealData}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 rounded-xl h-11"
          >
            {isTesting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </span>
            ) : "Enviar Teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
