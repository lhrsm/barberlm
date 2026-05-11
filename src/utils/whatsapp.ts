
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppParams {
  userId: string;
  eventType: 'appointment_confirmation' | 'reminder' | 'cancellation' | 'cashback' | 'payment_confirmed' | 'service_completed';
  phone: string;
  placeholders: Record<string, any>;
  appointmentId?: string;
}

export const triggerWhatsAppMessage = async ({
  userId,
  eventType,
  phone,
  placeholders,
  appointmentId
}: WhatsAppParams) => {
  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-cloud', {
      body: {
        user_id: userId,
        event_type: eventType,
        phone,
        placeholders,
        appointment_id: appointmentId
      },
      method: 'POST'
    });

    if (error) {
      console.error('Error triggering WhatsApp message:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error triggering WhatsApp:', err);
    return { success: false, error: err };
  }
};
