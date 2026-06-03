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
      console.log('Appointment schema loaded - Updating appointment status', { appointmentId, newStatus, source, metadata });
      
      const { data: { user } } = await supabase.auth.getUser();
      
      let result;
      
      if (newStatus === 'cancelled') {
        const { data, error } = await supabase.rpc('cancel_appointment', {
          p_appointment_id: appointmentId,
          p_cancelled_by: source.includes('portal') ? 'customer' : 'admin',
          p_source: source,
          p_refund_preference: metadata.refund_preference || 'none',
          p_changed_by_id: user?.id || undefined
        });
        
        if (error) throw error;
        result = data as any;
      } else if (newStatus === 'completed') {
        const { data, error } = await supabase.rpc('complete_appointment', {
          p_appointment_id: appointmentId,
          p_changed_by_type: source.includes('portal') ? 'customer' : 'admin',
          p_changed_by_id: user?.id || undefined,
          p_source: source,
          p_metadata: metadata
        });
        
        if (error) throw error;
        result = data as any;
      } else {
        const { data, error } = await supabase.rpc('update_appointment_status', {
          p_appointment_id: appointmentId,
          p_new_status: newStatus,
          p_changed_by_type: source.includes('portal') ? 'customer' : 'admin',
          p_changed_by_id: user?.id || undefined,
          p_source: source,
          p_metadata: metadata
        });
        
        if (error) throw error;
        result = data as any;
      }

      console.log('APPOINTMENT_STATUS_UPDATE_SUCCESS', { appointmentId, newStatus, result });
      
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
        ['barber-dashboard'], ['customer-appointments']
      ];

      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      return { success: true, ...(typeof result === 'object' ? result : {}) };
    } catch (error: any) {
      console.error('APPOINTMENT_STATUS_UPDATE_FATAL', error);
      toast.error(error.message || "Erro ao atualizar status do agendamento");
      return { success: false, error };
    }
  };

  return { updateStatus };
}
