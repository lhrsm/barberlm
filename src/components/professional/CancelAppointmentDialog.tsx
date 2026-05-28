import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CancelAppointmentDialog({ isOpen, onClose, appointment, onConfirm }: any) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason) {
      toast.error("Por favor, insira o motivo do cancelamento.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: 'cancelled', cancel_reason: reason })
        .eq("id", appointment.id);
      
      if (error) throw error;
      toast.success("Atendimento cancelado com sucesso.");
      onConfirm();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao cancelar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar Atendimento</DialogTitle>
        </DialogHeader>
        <Textarea 
          placeholder="Motivo do cancelamento..." 
          value={reason} 
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>Confirmar Cancelamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
