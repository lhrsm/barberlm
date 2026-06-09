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
    return await executeCancellation(appointmentId, 'none', source);
  };

  const confirmCancellationWithCredit = async (appointmentId: string, source: string = 'customer_portal') => {
    try {
      // Fetch appointment details first to get tenant_id, customer_id and amount
      const { data: appt, error: apptError } = await supabase
        .from("appointments")
        .select("tenant_id, customer_id, total_price, pix_amount, credits_used, cashback_used")
        .eq("id", appointmentId)
        .single();

      if (apptError) throw apptError;
      if (!appt.customer_id || !appt.tenant_id) throw new Error("Dados do agendamento incompletos");

      // Use the specialized credit conversion RPC
      const { data, error } = await supabase.rpc('convert_appointment_to_credit', {
        p_appointment_id: appointmentId,
        p_customer_id: appt.customer_id,
        p_tenant_id: appt.tenant_id,
        p_amount: Number(appt.total_price || 0)
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
      const { data: appt, error: apptError } = await supabase
        .from("appointments")
        .select("tenant_id, customer_id, total_price, pix_amount")
        .eq("id", appointmentId)
        .single();

      if (apptError) throw apptError;
      if (!appt.customer_id || !appt.tenant_id) throw new Error("Dados do agendamento incompletos");

      // Use the specialized refund request RPC
      const { data, error } = await supabase.rpc('request_appointment_refund', {
        p_appointment_id: appointmentId,
        p_customer_id: appt.customer_id,
        p_tenant_id: appt.tenant_id,
        p_amount: Number(appt.pix_amount || appt.total_price || 0),
        p_pix_key: refundData.pixKey,
        p_pix_key_type: refundData.pixType,
        p_account_holder_name: refundData.holderName,
        p_notes: refundData.notes || 'Cancelamento solicitado pelo cliente'
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

      await finalizeCancellation(appointmentId);
      return { success: true };
    } catch (error: any) {
      console.error("Cancellation execution failed:", error);
      toast.error(error.message || "Erro ao cancelar agendamento");
      return { success: false, error };
    }
  };

  const finalizeCancellation = async (appointmentId: string) => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
    queryClient.invalidateQueries({ queryKey: ['customer-appointments'] });
    queryClient.invalidateQueries({ queryKey: ['customerAppointments'] });
    queryClient.invalidateQueries({ queryKey: ['credits'] });
    queryClient.invalidateQueries({ queryKey: ['finances'] });
    
    // Optional: trigger automation here if not handled by DB trigger
    // but the existing handleCancel functions triggered it manually.
  };

  return {
    getFinancialStatus,
    confirmSimpleCancellation,
    confirmCancellationWithCredit,
    confirmCancellationWithRefundRequest
  };
}
