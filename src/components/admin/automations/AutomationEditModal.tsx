
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AutomationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  automation: any;
  onSave: () => void;
}

const VARIABLES = [
  { label: "{customer_name}", value: "{customer_name}" },
  { label: "{barbershop_name}", value: "{barbershop_name}" },
  { label: "{service_name}", value: "{service_name}" },
  { label: "{professional_name}", value: "{professional_name}" },
  { label: "{appointment_date}", value: "{appointment_date}" },
  { label: "{appointment_time}", value: "{appointment_time}" },
  { label: "{service_price}", value: "{service_price}" },
];

export function AutomationEditModal({
  isOpen,
  onClose,
  automation,
  onSave,
}: AutomationEditModalProps) {
  const [formData, setFormData] = useState<any>({
    name: "",
    active: true,
    channel: "whatsapp",
    template: "",
    buttons: [],
    trigger_event: "appointment.created",
    requires_callback: false,
  });

  useEffect(() => {
    if (automation) {
      setFormData({
        name: automation.name || "",
        active: automation.active ?? true,
        channel: automation.channel || "whatsapp",
        template: automation.template || "",
        buttons: automation.buttons || [],
        trigger_event: automation.trigger_event || "appointment.created",
        requires_callback: automation.requires_callback ?? false,
      });
    }
  }, [automation]);

  const insertVariable = (variable: string) => {
    setFormData((prev: any) => ({
      ...prev,
      template: prev.template + variable,
    }));
  };

  const handleSave = async () => {
    try {
      const { error } = await (supabase as any)
        .from("automation_templates")
        .update({
          name: formData.name,
          active: formData.active,
          channel: formData.channel,
          template: formData.template,
          buttons: formData.buttons,
          requires_callback: formData.requires_callback,
        })
        .eq("id", automation.id);

      if (error) throw error;
      toast.success("Automação salva com sucesso!");
      onSave();
      onClose();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Automação</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome da automação</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Status</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requires_callback">Exige resposta do cliente</Label>
              <p className="text-[10px] text-muted-foreground">Ative para automações com botões que aguardam interação.</p>
            </div>
            <Switch
              id="requires_callback"
              checked={formData.requires_callback}
              onCheckedChange={(checked) => setFormData({ ...formData, requires_callback: checked })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Canal de envio</Label>
            <Select
              value={formData.channel}
              onValueChange={(val) => setFormData({ ...formData, channel: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email" disabled>E-mail (em breve)</SelectItem>
                <SelectItem value="sms" disabled>SMS (em breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Gatilho (apenas leitura)</Label>
            <Badge variant="outline" className="w-fit">
              {formData.trigger_event}
            </Badge>
          </div>

          <div className="grid gap-2">
            <Label>Template da mensagem</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {VARIABLES.map((v) => (
                <Button
                  key={v.value}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 px-2"
                  onClick={() => insertVariable(v.value)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
            <Textarea
              rows={8}
              value={formData.template}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              placeholder="Digite a mensagem..."
            />
          </div>
          
          {/* Simple Button Editor (Can be expanded if needed) */}
          <div className="grid gap-2">
            <Label>Botões (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-2">Configure os botões que aparecerão na mensagem.</p>
            {/* Logic for buttons could be added here if complex, for now we keep it simple */}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
