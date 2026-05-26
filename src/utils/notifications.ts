import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_confirmed'
  | 'payment_received';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  barberId?: string;
  customerId?: string;
  metadata?: any;
}

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  barberId,
  customerId,
  metadata = {}
}: CreateNotificationParams) => {
  try {
    console.log('NOTIFICATION CREATING...', { userId, type, title });
    
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_barber_id: barberId || null,
      p_customer_id: customerId || null,
      p_metadata: metadata
    });

    if (error) {
      console.error('NOTIFICATION ERROR (RPC)', error);
      // Fallback to direct insert if RPC fails
      const { data: directData, error: directError } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type,
          title,
          message,
          barber_id: barberId,
          customer_id: customerId,
          metadata
        }]);
      
      if (directError) {
        console.error('NOTIFICATION ERROR (DIRECT)', directError);
        return null;
      }
      return directData;
    }

    console.log('NOTIFICATION CREATED SUCCESS', data);
    return data;
  } catch (err) {
    console.error('NOTIFICATION CRITICAL ERROR', err);
    return null;
  }
};
