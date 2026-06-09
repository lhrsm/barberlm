import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";

export type CancellationStep = 'none' | 'simple_confirmation' | 'financial_decision' | 'pix_refund_form';

export interface FinancialStatus {
  can_cancel_directly: boolean;
  requires_financial_decision: boolean;
  has_paid_pix: boolean;
  paid_pix_amount: number;
  has_used_credits: boolean;
  used_credit_amount: number;
  payment_id: string | null;
  total_price: number;
}

export function useCustomerCancellation() {
  const queryClient = useQueryClient();

  const getFinancialStatus = async (appointmentId: string): Promise<FinancialStatus> => {
    try {
      const { data, error } = await supabase.rpc('check_appointment_financial_status', {
        p_appointment_id: appointmentId
      });

      if (error) throw error;
      return data as unknown as FinancialStatus;
    } catch (err: any) {
      console.error("Error checking financial status:", err);
      throw new Error("Erro ao verificar status financeiro");
    }
  };

  const confirmSimpleCancellation = async (appointmentId: string, source: string = 'customer_portal') => {
    return await executeCancellation(appointmentId, 'none', source);
  };

  const confirmCancellationWithCredit = async (appointmentId: string, source: string = 'customer_portal') => {
    return await executeCancellation(appointmentId, 'credits', source);
  };

  const confirmCancellationWithRefundRequest = async (
    appointmentId: string, 
    refundData: { holderName: string; pixKey: string; pixType: string; notes?: string },
    source: string = 'customer_portal'
  ) => {
    const result = await executeCancellation(appointmentId, 'refund', source);
    
    if (result.success) {
      // Update the refund request with PIX data
      const { error: refundError } = await supabase
        .from('refund_requests')
        .update({
          holder_name: refundData.holderName,
          pix_key: refundData.pixKey,
          pix_type: refundData.pixType,
          notes: refundData.notes
        })
        .eq('appointment_id', appointmentId)
        .eq('status', 'requested');

      if (refundError) {
        console.error("Error updating refund request details:", refundError);
        toast.error("Agendamento cancelado, mas houve um erro ao salvar os dados do Pix. Entre em contato com o suporte.");
      }
    }
    
    return result;
  };

  const executeCancellation = async (
    appointmentId: string, 
    preference: 'credits' | 'refund' | 'none',
    source: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointmentId,
        p_cancelled_by: 'customer',
        p_source: source,
        p_refund_preference: preference,
        p_changed_by_id: user?.id || undefined
      });

      if (error) throw error;
      const response = data as any;
      
      if (response && response.success === false) {
        throw new Error(response.error || "Erro ao processar cancelamento");
      }

      // Trigger notifications and invalidations
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['customer-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['customerAppointments'] });
      
      toast.success("Agendamento cancelado com sucesso.");
      return { success: true };
    } catch (error: any) {
      console.error("Cancellation execution failed:", error);
      toast.error(error.message || "Erro ao cancelar agendamento");
      return { success: false, error };
    }
  };

  return {
    getFinancialStatus,
    confirmSimpleCancellation,
    confirmCancellationWithCredit,
    confirmCancellationWithRefundRequest
  };
}
