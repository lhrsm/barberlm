import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { triggerWhatsAppMessage } from "@/utils/whatsapp";
import { emitAutomationEvent } from "@/utils/emit-event";

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

        // WhatsApp Notification
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
        const { data, error } = await supabase.rpc('complete_appointment', {
          p_appointment_id: appointmentId,
          p_changed_by_type: source.includes('portal') ? 'customer' : 'admin',
          p_changed_by_id: user?.id as any,
          p_source: source,
          p_metadata: metadata
        });
        
        if (error) throw error;
        result = data as any;
      } else if (newStatus === 'cancelled') {
        const { data, error } = await supabase.rpc('cancel_appointment', {
          p_appointment_id: appointmentId,
          p_cancelled_by: (source.includes('portal') ? 'customer' : 'admin') as any,
          p_source: source,
          p_refund_preference: (metadata?.refund_preference as string) || 'none',
          p_changed_by_id: user?.id as any,
        } as any);
        if (error) throw error;
        result = data as any;
      } else {
        const { error: updErr } = await supabase
          .from('appointments')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', appointmentId);
        if (updErr) throw updErr;
        result = { success: true } as any;
      }

      if (!result?.success) {
        toast.error(result?.error || `Erro ao marcar como ${newStatus}`);
        return { success: false, ...result };
      }

      // Event-driven automations (fire-and-forget; templates control who receives)
      if (appt?.tenant_id) {
        const cancelledBy = source.includes('portal') || source.includes('user_panel') || source.includes('public_link')
          ? 'by_customer'
          : source.includes('barber') || source.includes('professional')
            ? 'by_barber'
            : 'by_shop';

        const eventMap: Record<string, string> = {
          confirmed: 'appointment.confirmed',
          completed: 'appointment.completed',
          cancelled: `appointment.cancelled.${cancelledBy}`,
          in_progress: 'appointment.started',
        };
        const evt = eventMap[newStatus];
        if (evt) {
          emitAutomationEvent({
            tenantId: appt.tenant_id,
            event: evt as any,
            appointmentId,
            customerId: appt.customer_id,
            extra: {
              cancel_reason: metadata?.cancel_reason || metadata?.reason || '',
              payment_method: appt.payment_method || '',
            },
          });
        }
      }

      const statusLabels: Record<string, string> = {
        confirmed: "confirmado",
        completed: "concluído",
        cancelled: "cancelado",
        scheduled: "agendado"
      };

      toast.success(`Agendamento ${statusLabels[newStatus] || newStatus} com sucesso!`);
      
      // Invalidação centralizada
      queryClient.invalidateQueries();
      
      return { success: true, ...result };
    } catch (error: any) {
      console.error('APPOINTMENT_STATUS_UPDATE_FATAL', error);
      toast.error(error.message || "Erro ao atualizar status do agendamento");
      return { success: false, error };
    }
  };

  return { updateStatus };
}
