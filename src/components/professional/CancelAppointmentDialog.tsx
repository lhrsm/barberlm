import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, X, Info } from "lucide-react";

export function CancelAppointmentDialog({ isOpen, onClose, appointment, onConfirm }: any) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { updateStatus } = useAppointmentStatus();

  const handleConfirm = async () => {
    if (!reason) {
      toast.error("Por favor, insira o motivo do cancelamento.");
      return;
    }
    setLoading(true);
    try {
      const result = await updateStatus(
        appointment.id, 
        'cancelled', 
        { cancel_reason: reason }, 
        'barber_panel'
      );
      
      if (!result.success) throw result.error;

      // Update cancel_reason separately as it's not a status but a detail
      await supabase
        .from("appointments")
        .update({ cancel_reason: reason })
        .eq("id", appointment.id);

      onConfirm();
      onClose();
    } catch (e: any) {
      console.error("Erro ao cancelar:", e);
      toast.error("Erro ao cancelar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0b0f17] border-red-900/30 rounded-2xl shadow-2xl text-white">
        <DialogHeader className="pb-4 border-b border-white/5">
          <DialogTitle className="text-xl font-black flex items-center gap-3 text-red-500 uppercase tracking-wider">
            <AlertTriangle className="h-6 w-6" /> Cancelar Atendimento
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-6">
          <div className="bg-red-950/20 border border-red-900/20 p-5 rounded-xl">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200/80 font-medium leading-relaxed">
                Você está prestes a cancelar o atendimento de <span className="text-white font-black underline">{appointment?.customers?.name || "Cliente"}</span>. Esta ação enviará uma notificação ao cliente.
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.2em] ml-1">Motivo do Cancelamento</label>
            <Textarea 
              placeholder="Ex: Profissional teve um imprevisto, cliente solicitou via telefone..." 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#05070d] border-white/10 focus-visible:ring-red-500/40 min-h-[120px] rounded-xl text-white placeholder:text-gray-600 font-medium resize-none transition-all focus:border-red-500/50"
            />
            <p className="text-[10px] text-gray-500 font-medium italic">O motivo será compartilhado com o cliente para transparência.</p>
          </div>
        </div>
        
        <DialogFooter className="gap-3 pt-4 border-t border-white/5">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/5 font-bold rounded-xl h-10 px-6"
          >
            <X className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-black px-8 h-10 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-900/20"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Confirmar Cancelamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
