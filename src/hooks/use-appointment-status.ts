import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";

export function useAppointmentStatus() {
  const queryClient = useQueryClient();

  const updateStatus = async (
    appointmentId: string, 
    newStatus: string, 
    metadata: any = {}, 
    source: string = 'frontend'
  ) => {
    try {
      console.log('Appointment status update starting', { appointmentId, newStatus, source, metadata });
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch current appointment data for notifications
      const { data: appt } = await supabase
        .from("appointments")
        .select("*, customers(*), profiles(*), barbers(*), services(*)")
        .eq("id", appointmentId)
        .single();

      let result;
      
      if (newStatus === 'cancelled') {
        const { data, error } = await supabase.rpc('cancel_appointment', {
          p_appointment_id: appointmentId,
          p_cancelled_by: source.includes('portal') || source.includes('user_panel') || source.includes('public_link') ? 'customer' : 'admin',
          p_source: source,
          p_refund_preference: metadata.refund_preference || 'none',
          p_changed_by_id: user?.id || undefined
        });
        
        if (error) throw error;
        result = data as any;

        // Functional Notification
        if (appt?.profiles?.whatsapp_enabled && appt?.customers?.phone) {
          triggerWhatsAppMessage({
            userId: appt.tenant_id,
            eventType: 'cancellation',
            phone: appt.customers.phone,
            appointmentId: appointmentId,
            placeholders: {
              cliente_nome: appt.customers.name,
              barbearia_nome: appt.profiles.business_name,
              servico: appt.services?.name
            }
          });
        }
      } else if (newStatus === 'completed') {
        // CORREÇÃO: Passar valores normalizados se for pagamento misto
        const finalMetadata = { ...metadata };
        if (metadata.payment_method === 'mixed' || metadata.payment_method === 'misto') {
           // Garantir que os campos pix_amount e cash_amount existam se não foram enviados
           finalMetadata.pix_amount = Number(metadata.pix_amount || 0);
           finalMetadata.cash_amount = Number(metadata.cash_amount || 0);
           finalMetadata.credit_card_amount = Number(metadata.credit_card_amount || 0);
           finalMetadata.debit_card_amount = Number(metadata.debit_card_amount || 0);
           finalMetadata.credits_used = Number(metadata.credits_used || metadata.credit_used || 0);
           finalMetadata.cashback_used = Number(metadata.cashback_used || 0);
        }

        const { data, error } = await supabase.rpc('complete_appointment', {
          p_appointment_id: appointmentId,
          p_changed_by_type: source.includes('portal') ? 'customer' : 'admin',
          p_changed_by_id: user?.id as any,
          p_source: source,
          p_metadata: finalMetadata
        });
        
        if (error) throw error;
        result = data as any;
      } else {
        const { data, error } = await supabase.rpc('update_appointment_status', {
          p_appointment_id: appointmentId,
          p_new_status: newStatus,
          p_changed_by_type: source.includes('portal') ? 'customer' : 'admin',
          p_changed_by_id: user?.id as any,
          p_source: source,
          p_metadata: metadata
        });
        
        if (error) throw error;
        result = data as any;
      }

      console.log('APPOINTMENT_STATUS_UPDATE_RESULT', { appointmentId, newStatus, result });
      
      if (!result?.success) {
        console.error('APPOINTMENT_STATUS_UPDATE_FAILED', { appointmentId, newStatus, result });
        toast.error(result?.error || `Erro ao marcar como ${newStatus}`);
        return { success: false, ...result };
      }

      const statusLabels: Record<string, string> = {
        confirmed: "confirmado",
        completed: "concluído",
        cancelled: "cancelado",
        scheduled: "agendado"
      };

      toast.success(`Agendamento ${statusLabels[newStatus] || newStatus} com sucesso!`);
      
      const queryKeys = [
        ['appointments'], ['calendar'], ['dashboard'], ['customerAppointments'],
        ['calendar-appointments'], ['dashboard-appointments'], ['admin-stats'],
        ['admin-dashboard'], ['professional-dashboard'], ['professional-appointments'],
        ['credits'], ['finances'], ['financial-dashboard'], ['customer-portal'],
        ['barber-dashboard'], ['customer-appointments'], ['customers']
      ];

      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      return { success: true, ...result };
    } catch (error: any) {
      console.error('APPOINTMENT_STATUS_UPDATE_FATAL', error);
      toast.error(error.message || "Erro ao atualizar status do agendamento");
      return { success: false, error };
    }
  };

  return { updateStatus };
}
