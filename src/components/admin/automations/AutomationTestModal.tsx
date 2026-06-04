
import React, { useState } from "react";
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

  const handleTest = async () => {
    if (!phone) {
      toast.error("Informe um telefone de destino");
      return;
    }

    setIsTesting(true);
    try {
      const testData = {
        customer_name: "Cliente Teste",
        barbershop_name: "Barbearia Teste",
        service_name: "Corte Masculino",
        professional_name: "Profissional Teste",
        appointment_date: new Date().toLocaleDateString("pt-BR"),
        appointment_time: "10:00",
        service_price: "R$ 50,00",
      };

      let renderedTemplate = automation.template;
      Object.entries(testData).forEach(([key, value]) => {
        renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value);
      });

      // Call the zapi-api edge function for the actual send
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

      const { error: logError } = await (supabase as any).from("automation_logs").insert({
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        phone: phone,
        status: isSuccess ? "sent" : "error",
        message_type: automation.key,
        processed_template: renderedTemplate,
        original_template: automation.template,
        provider: "zapi",
        sent_at: new Date().toISOString(),
        payload: { test_data: testData, rendered: renderedTemplate },
        error_message: isSuccess ? null : (zapiData?.error || "Erro desconhecido no envio"),
        response: zapiData?.result
      });

      if (logError) console.error("Error saving log:", logError);

      if (!isSuccess) {
        throw new Error(zapiData?.error || "Falha ao enviar mensagem via Z-API");
      }

      toast.success("Teste enviado com sucesso!");
      onClose();
    } catch (error: any) {
      toast.error("Erro ao enviar teste: " + error.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Testar Automação</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone de destino</Label>
            <Input
              id="phone"
              placeholder="Ex: 5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Dados do teste</Label>
            <RadioGroup value={testType} onValueChange={setTestType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fictitious" id="fictitious" />
                <Label htmlFor="fictitious">Usar dados fictícios</Label>
              </div>
              <div className="flex items-center space-x-2 opacity-50">
                <RadioGroupItem value="real" id="real" disabled />
                <Label htmlFor="real">Último agendamento real (em breve)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-xs">
            <p className="font-semibold mb-2">Preview da mensagem:</p>
            <p className="whitespace-pre-wrap text-slate-600 italic">
              A mensagem será enviada com os dados do teste para o número informado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isTesting}>
            Cancelar
          </Button>
          <Button onClick={handleTest} disabled={isTesting}>
            {isTesting ? "Enviando..." : "Enviar Teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
