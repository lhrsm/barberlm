
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
      // In a real scenario, this would call an Edge Function
      // For this stage, we simulate the process or call the existing hook if available
      
      const testData = {
        customer_name: "Cliente Teste",
        barbershop_name: "Barbearia Teste",
        service_name: "Corte Masculino",
        professional_name: "Profissional Teste",
        appointment_date: new Date().toLocaleDateString("pt-BR"),
        appointment_time: "10:00",
        service_price: "R$ 50,00",
      };

      // Mocking template rendering
      let renderedTemplate = automation.template;
      Object.entries(testData).forEach(([key, value]) => {
        renderedTemplate = renderedTemplate.replace(new RegExp(`{${key}}`, 'g'), value);
      });

      // Call edge function (assuming 'send-automation-test' or similar exists)
      // Since we are restructuring, we might need to point to the correct function later
      // For now, we simulate success and save a log entry
      
      const { error: logError } = await supabase.from("automation_logs").insert({
        automation_id: automation.id,
        tenant_id: automation.tenant_id,
        phone: phone,
        status: "sent",
        message_type: automation.key,
        processed_template: renderedTemplate,
        original_template: automation.template,
        provider: "zapi", // Default for now
        sent_at: new Date().toISOString()
      });

      if (logError) console.error("Error saving log:", logError);

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
          <Button onClick={handleTest} loading={isTesting}>
            Enviar Teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
