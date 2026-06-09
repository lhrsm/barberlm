import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type CancellationStep = 'none' | 'simple_confirmation' | 'financial_decision' | 'pix_refund_form';

export interface FinancialStatus {
  can_cancel_directly: boolean;
  requires_financial_decision: boolean;
  has_paid_pix: boolean;
  paid_pix_amount: number;
  has_used_credits: boolean;
  used_credit_amount: number;
  has_used_cashback: boolean;
  used_cashback_amount: number;
  payment_id: string | null;
  total_price: number;
  status: string;
  payment_status: string;
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
    try {
      const { data, error } = await supabase.rpc('customer_cancel_simple', {
        p_appointment_id: appointmentId,
        p_source: source
      });

      if (error) throw error;
      const response = data as any;
      if (response && response.success === false) throw new Error(response.error || "Erro ao cancelar");

      await finalizeCancellation(appointmentId);
      return { success: true };
    } catch (error: any) {
      console.error("Simple cancellation failed:", error);
      toast.error(error.message || "Erro ao cancelar agendamento");
      return { success: false, error };
    }
  };

  const confirmCancellationWithCredit = async (appointmentId: string, source: string = 'customer_portal') => {
    try {
      const { data, error } = await supabase.rpc('customer_cancel_return_credit', {
        p_appointment_id: appointmentId,
        p_source: source
      });

      if (error) throw error;
      const response = data as any;
      if (response && response.success === false) throw new Error(response.error || "Erro ao converter em crédito");

      await finalizeCancellation(appointmentId);
      return { success: true };
    } catch (error: any) {
      console.error("Credit cancellation failed:", error);
      toast.error(error.message || "Erro ao cancelar e converter em crédito");
      return { success: false, error };
    }
  };

  const confirmCancellationWithRefundRequest = async (
    appointmentId: string, 
    refundData: { holderName: string; pixKey: string; pixType: string; notes?: string },
    source: string = 'customer_portal'
  ) => {
    try {
      const { data, error } = await supabase.rpc('customer_cancel_request_refund', {
        p_appointment_id: appointmentId,
        p_holder_name: refundData.holderName,
        p_pix_key: refundData.pixKey,
        p_pix_type: refundData.pixType,
        p_notes: refundData.notes || 'Cancelamento solicitado pelo cliente via portal',
        p_source: source
      });

      if (error) throw error;
      const response = data as any;
      if (response && response.success === false) throw new Error(response.error || "Erro ao solicitar estorno");

      await finalizeCancellation(appointmentId);
      return { success: true };
    } catch (error: any) {
      console.error("Refund cancellation failed:", error);
      toast.error(error.message || "Erro ao solicitar estorno");
      return { success: false, error };
    }
  };

  const finalizeCancellation = async (appointmentId: string) => {
    // Invalidação agressiva de cache
    const queryKeys = [
      ['appointments'], 
      ['calendar'], 
      ['customer-appointments'], 
      ['customerAppointments'], 
      ['credits'], 
      ['finances'],
      ['calendar-appointments'],
      ['dashboard-appointments'],
      ['customer-portal']
    ];
    
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  };

  return {
    getFinancialStatus,
    confirmSimpleCancellation,
    confirmCancellationWithCredit,
    confirmCancellationWithRefundRequest
  };
}
