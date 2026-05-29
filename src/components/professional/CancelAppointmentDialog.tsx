import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

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
      <DialogContent className="max-w-md bg-white border-[#D4AF37] rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#111827]">
            <AlertCircle className="h-5 w-5 text-red-500" /> Cancelar Atendimento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-[#6B7280]">
            Você está prestes a cancelar o atendimento para <span className="font-bold text-[#111827]">{appointment?.customers?.name || "Cliente"}</span>. Esta ação não pode ser desfeita.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-[#D4AF37]">Motivo do Cancelamento</label>
            <Textarea 
              placeholder="Ex: Profissional teve um imprevisto, cliente solicitou via telefone..." 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-[#6B7280] hover:bg-gray-100"
          >
            Voltar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 font-bold"
          >
            {loading ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
