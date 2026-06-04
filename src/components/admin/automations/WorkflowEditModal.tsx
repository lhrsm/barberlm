
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkflowEditModalProps {
  workflow: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_VARIABLES = [
  "{customer_name}",
  "{barbershop_name}",
  "{service_name}",
  "{professional_name}",
  "{appointment_date}",
  "{appointment_time}",
  "{service_price}",
  "{appointment_status}",
  "{credit_amount}",
  "{cashback_amount}",
  "{payment_method}"
];

export function WorkflowEditModal({ workflow, isOpen, onClose, onSuccess }: WorkflowEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: "",
    active: true,
    template: "",
    channel: "whatsapp",
    delay_minutes: 0,
    conditions: {},
    recipient: "customer"
  });

  useEffect(() => {
    if (workflow) {
      setFormData({
        name: workflow.name || "",
        active: workflow.active ?? true,
        template: workflow.configuration?.template || "",
        channel: workflow.configuration?.channel || "whatsapp",
        delay_minutes: workflow.configuration?.delay_minutes || 0,
        conditions: workflow.configuration?.conditions || {},
        recipient: workflow.configuration?.recipient || "customer"
      });
    }
  }, [workflow]);

  const handleCopyVariable = (variable: string) => {
    setFormData((prev: any) => ({
      ...prev,
      template: prev.template + variable
    }));
    toast.success(`Variável ${variable} adicionada ao template`);
  };

  const validateTemplate = (template: string) => {
    if (!template.trim()) return "O template não pode estar vazio.";
    
    // Check for variables that are not in AVAILABLE_VARIABLES
    const matches = template.match(/\{[a-zA-Z0-9_]+\}/g) || [];
    const invalidVariables = matches.filter(v => !AVAILABLE_VARIABLES.includes(v));
    
    if (invalidVariables.length > 0) {
      return `Variáveis inválidas encontradas: ${invalidVariables.join(", ")}`;
    }
    
    return null;
  };

  const handleSave = async () => {
    const errorMsg = validateTemplate(formData.template);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase
        .from("automation_v2_workflows" as any) as any)
        .update({
          name: formData.name,
          active: formData.active,
          configuration: {
            ...workflow.configuration,
            template: formData.template,
            channel: formData.channel,
            delay_minutes: Number(formData.delay_minutes),
            conditions: formData.conditions,
            recipient: formData.recipient
          }
        })
        .eq("id", workflow.id);

      if (error) throw error;

      // Log success
      await (supabase.from("automation_v2_logs") as any).insert({
        tenant_id: workflow.tenant_id,
        event_name: workflow.event_name,
        flow_type: workflow.configuration?.flow_type || "single",
        action: "workflow_updated",
        status: "success",
        message: `Workflow ${workflow.name} atualizado manualmente.`
      });

      toast.success("Automação atualizada com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating workflow:", error);
      
      // Log error
      await (supabase.from("automation_v2_logs") as any).insert({
        tenant_id: workflow.tenant_id,
        event_name: workflow.event_name,
        flow_type: workflow.configuration?.flow_type || "single",
        action: "workflow_updated",
        status: "error",
        message: `Erro ao atualizar workflow: ${error.message}`,
        error: error.message
      });

      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!workflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Editar Automação
            <span className="text-xs font-mono bg-zinc-900 px-2 py-1 rounded text-zinc-500">
              {workflow.workflow_key}
            </span>
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Configure o comportamento e a mensagem deste fluxo de automação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Automação</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2 h-10 px-3 bg-zinc-900 rounded-md border border-zinc-800">
                <Switch 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <span className="text-sm font-medium">
                  {formData.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_name">Evento (Gatilho)</Label>
              <Input 
                id="event_name" 
                value={workflow.event_name} 
                disabled 
                className="bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow_type">Tipo de Fluxo</Label>
              <Input 
                id="flow_type" 
                value={workflow.configuration?.flow_type || "single"} 
                disabled 
                className="bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="channel">Canal de Envio</Label>
              <Select 
                value={formData.channel} 
                onValueChange={(val) => setFormData({ ...formData, channel: val })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="whatsapp">WhatsApp (Z-API)</SelectItem>
                  <SelectItem value="internal">Notificação Interna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient">Destinatário</Label>
              <Select 
                value={formData.recipient} 
                onValueChange={(val) => setFormData({ ...formData, recipient: val })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Selecione o destinatário" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay">Tempo de Disparo (minutos)</Label>
            <Input 
              id="delay" 
              type="number"
              value={formData.delay_minutes} 
              onChange={(e) => setFormData({ ...formData, delay_minutes: e.target.value })}
              className="bg-zinc-900 border-zinc-800"
              placeholder="0 para imediato"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="template">Template da Mensagem</Label>
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Info size={10} /> Não esqueça as variáveis
              </span>
            </div>
            <Textarea 
              id="template" 
              value={formData.template} 
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              className="bg-zinc-900 border-zinc-800 min-h-[120px] font-sans"
              placeholder="Digite sua mensagem aqui..."
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Variáveis Disponíveis</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
              {AVAILABLE_VARIABLES.map(variable => (
                <button
                  key={variable}
                  onClick={() => handleCopyVariable(variable)}
                  className="px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors flex items-center gap-1 text-zinc-300 hover:text-white"
                  title="Clique para adicionar ao template"
                >
                  <Copy size={8} />
                  {variable}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Cancelar
          </Button>
          <div className="flex gap-2">
             <Button 
                variant="outline" 
                className="border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black"
                onClick={() => toast.info("Salve antes de testar para aplicar as mudanças")}
             >
               Testar
             </Button>
             <Button 
                onClick={handleSave} 
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold min-w-[120px]"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salvar Alterações"}
              </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
