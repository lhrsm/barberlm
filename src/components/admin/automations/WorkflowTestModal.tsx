
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Smartphone, User } from "lucide-react";

interface WorkflowTestModalProps {
  workflow: any;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkflowTestModal({ workflow, isOpen, onClose }: WorkflowTestModalProps) {
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<"real" | "dummy">("dummy");
  const [phone, setPhone] = useState("");
  const [lastAppointment, setLastAppointment] = useState<any>(null);

  useEffect(() => {
    if (isOpen && workflow?.tenant_id) {
      fetchLastAppointment();
    }
  }, [isOpen, workflow]);

  const fetchLastAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customers(name, phone),
          services(name, price),
          barbers(name)
        `)
        .eq("tenant_id", workflow.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLastAppointment(data);
        if (data.customers?.phone) {
          setPhone(data.customers.phone);
        }
      }
    } catch (error) {
      console.error("Error fetching last appointment:", error);
    }
  };

  const handleSendTest = async () => {
    if (!phone) {
      toast.error("Por favor, insira um telefone de destino.");
      return;
    }

    setLoading(true);
    try {
      // Create a test queue item or call the function directly
      // For testing, we'll invoke the edge function with a test payload
      const { data, error } = await supabase.functions.invoke('automation-v2-runner', {
        body: {
          action: "test_send",
          workflow_id: workflow.id,
          phone: phone,
          test_type: testType,
          appointment_id: testType === "real" ? lastAppointment?.id : null
        }
      });

      if (error) {
        throw error;
      }

      if (data && data.success === false) {
        throw new Error(data.error || "Erro desconhecido na Edge Function");
      }

      await (supabase.from("automation_v2_logs") as any).insert({
        tenant_id: workflow.tenant_id,
        event_name: workflow.event_name,
        flow_type: workflow.configuration?.flow_type || "single",
        action: "test_send",
        status: "success",
        message: `Teste enviado para ${phone}`
      });

      toast.success("Teste enviado com sucesso!");
      onClose();
    } catch (error: any) {
      console.error("Error sending test:", error);
      
      await (supabase.from("automation_v2_logs") as any).insert({
        tenant_id: workflow.tenant_id,
        event_name: workflow.event_name,
        flow_type: workflow.configuration?.flow_type || "single",
        action: "test_send",
        status: "error",
        message: `Erro ao enviar teste: ${error.message}`,
        error: error.message
      });

      toast.error("Erro ao enviar teste: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!workflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Testar Automação
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Envie uma mensagem de teste para validar o template e o canal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label>Dados para o Teste</Label>
            <RadioGroup 
              value={testType} 
              onValueChange={(val: any) => setTestType(val)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="dummy" id="dummy" className="peer sr-only" />
                <Label
                  htmlFor="dummy"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 peer-data-[state=checked]:border-amber-500 [&:has([data-state=checked])]:border-amber-500 cursor-pointer"
                >
                  <User className="mb-2 h-6 w-6 text-zinc-400" />
                  <span className="text-xs font-semibold">Dados Fictícios</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="real" id="real" className="peer sr-only" disabled={!lastAppointment} />
                <Label
                  htmlFor="real"
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 peer-data-[state=checked]:border-amber-500 [&:has([data-state=checked])]:border-amber-500 cursor-pointer ${!lastAppointment ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Send className="mb-2 h-6 w-6 text-zinc-400" />
                  <span className="text-xs font-semibold">Último Real</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone de Destino</Label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input 
                id="phone" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999999999"
                className="bg-zinc-900 border-zinc-800 pl-10"
              />
            </div>
            <p className="text-[10px] text-zinc-500">Use o formato DDI + DDD + Número (ex: 5511999999999)</p>
          </div>

          {testType === "real" && lastAppointment && (
            <div className="p-3 bg-zinc-900 rounded-md border border-zinc-800 text-[11px] space-y-1">
              <p className="font-bold text-amber-500">Agendamento de Referência:</p>
              <p><span className="text-zinc-500">Cliente:</span> {lastAppointment.customers?.name}</p>
              <p><span className="text-zinc-500">Serviço:</span> {lastAppointment.services?.name}</p>
              <p><span className="text-zinc-500">Data:</span> {new Date(lastAppointment.start_time).toLocaleDateString()} às {new Date(lastAppointment.start_time).toLocaleTimeString()}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Cancelar
          </Button>
          <Button 
            onClick={handleSendTest} 
            disabled={loading}
            className="bg-zinc-900 border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black font-semibold min-w-[120px]"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Enviar Teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
