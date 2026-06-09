import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentStatus } from "@/hooks/use-appointment-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, X, DollarSign, Info } from "lucide-react";

export function CustomerAppointmentActions({ appointment, onCancelSuccess }: any) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refundData, setRefundData] = useState({ holderName: '', pixKey: '', pixType: 'cpf', notes: '' });
  const { updateStatus } = useAppointmentStatus();

  const handleCancelClick = () => {
    const isPixPaid = (['pix', 'PIX', 'Pix'].includes(appointment.payment_method) || (appointment.pix_amount && Number(appointment.pix_amount) > 0)) && 
                      ['paid', 'confirmed', 'completed', 'aprovado', 'pago'].includes(appointment.payment_status);
    
    if (isPixPaid) {
      setIsRefundModalOpen(true);
    } else {
      setIsCancelModalOpen(true);
    }
  };

  const handleConfirmCancel = async (preference: 'credits' | 'refund' | 'none' = 'none') => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointment.id,
        p_cancelled_by: 'customer',
        p_source: 'user_panel',
        p_refund_preference: preference,
        p_changed_by_id: undefined
      });
      
      if (error) throw error;
      
      if (preference === 'refund' && refundData.pixKey) {
        await supabase
          .from('refund_requests')
          .update({
            holder_name: refundData.holderName,
            pix_key: refundData.pixKey,
            pix_type: refundData.pixType,
            notes: refundData.notes
          })
          .eq('appointment_id', appointment.id)
          .eq('status', 'requested');
      }

      toast.success("Agendamento cancelado com sucesso!");
      setIsCancelModalOpen(false);
      setIsRefundModalOpen(false);
      onCancelSuccess();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <div className="flex gap-3">
        <Button onClick={handleCancelClick} className="flex-1 bg-red-600 hover:bg-red-700">Cancelar</Button>
      </div>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => handleConfirmCancel('none')}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Refund Modal logic similar to the one in $slug.portal.tsx but clean */}
    </>
  );
}
