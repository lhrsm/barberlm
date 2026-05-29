import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle, X } from "lucide-react";

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
      <DialogContent className="max-w-md bg-white border-[#D4AF37] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
        <DialogHeader className="pb-4 border-b border-[#D4AF37]/10">
          <DialogTitle className="text-xl font-black flex items-center gap-2 text-[#111827]">
            <AlertCircle className="h-6 w-6 text-red-500" /> Cancelar Atendimento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-6">
          <div className="bg-red-50 border border-red-100 p-4 rounded-[10px]">
            <p className="text-sm text-red-700 font-medium leading-relaxed">
              Você está prestes a cancelar o atendimento para <span className="font-black underline">{appointment?.customers?.name || "Cliente"}</span>. Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider">Motivo do Cancelamento</label>
            <Textarea 
              placeholder="Ex: Profissional teve um imprevisto, cliente solicitou via telefone..." 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              className="border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]/20 min-h-[120px] rounded-[10px] font-medium"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-[#D4AF37]/10">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-[#6B7280] hover:bg-gray-100 font-bold rounded-[10px]"
          >
            Voltar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-black px-6 h-11 rounded-[10px] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
