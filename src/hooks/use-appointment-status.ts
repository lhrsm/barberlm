import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useAppointmentStatus() {
  const queryClient = useQueryClient();

  const updateStatus = async (
    appointmentId: string, 
    newStatus: string, 
    metadata: any = {}, 
    source: string = 'frontend'
  ) => {
    try {
      console.log('APPOINTMENT_STATUS_UPDATE_START', { appointmentId, newStatus, source });
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Validação básica de status permitidos
      const allowedStatus = [
        'scheduled', 'confirmed', 'completed', 'cancelled', 
        'rescheduled', 'awaiting_payment', 'no_show', 'pending', 'in_progress'
      ];
      
      if (!allowedStatus.includes(newStatus)) {
        console.warn('STATUS_NOT_IN_STANDARD_LIST', newStatus);
      }

      const { error } = await supabase.rpc('update_appointment_status', {
        p_appointment_id: appointmentId,
        p_new_status: newStatus,
        p_changed_by_type: 'admin',
        p_changed_by_id: user?.id || null, // Importante: usar null em vez de string vazia
        p_source: source,
        p_metadata: metadata
      });

      if (error) {
        console.error('APPOINTMENT_STATUS_UPDATE_ERROR', {
          appointmentId,
          newStatus,
          error
        });
        throw error;
      }

      console.log('APPOINTMENT_STATUS_UPDATE_SUCCESS', { appointmentId, newStatus });
      
      const statusLabels: Record<string, string> = {
        confirmed: "confirmado",
        completed: "concluído",
        cancelled: "cancelado",
        scheduled: "agendado"
      };

      toast.success(`Agendamento ${statusLabels[newStatus] || newStatus} com sucesso!`);
      
      // Invalidação agressiva de cache para garantir sincronização entre painéis
      const queryKeys = [
        ['appointments'],
        ['calendar'],
        ['dashboard'],
        ['customerAppointments'],
        ['calendar-appointments'],
        ['dashboard-appointments'],
        ['admin-stats'],
        ['admin-dashboard'],
        ['professional-dashboard'],
        ['professional-appointments']
      ];

      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('APPOINTMENT_STATUS_UPDATE_FATAL', error);
      toast.error(error.message || "Erro ao atualizar status do agendamento");
      return { success: false, error };
    }
  };

  return { updateStatus };
}
