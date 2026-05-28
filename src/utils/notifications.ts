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
    
    // Create a unique key for deduplication if possible
    let uniqueKey = metadata.unique_key;
    if (!uniqueKey && metadata.appointment_id) {
      uniqueKey = `${type}:${userId}:${metadata.appointment_id}`;
    }

    if (uniqueKey) {
      // Check if it already exists to avoid duplicates
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('unique_key', uniqueKey)
        .maybeSingle();
      
      if (existing) {
        console.log('NOTIFICATION ALREADY EXISTS, SKIPPING', { uniqueKey });
        return existing;
      }
    }
    
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_barber_id: barberId || undefined,
      p_customer_id: customerId || undefined,
      p_metadata: { ...metadata, unique_key: uniqueKey }
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
          metadata: { ...metadata, unique_key: uniqueKey },
          unique_key: uniqueKey
        }])
        .select()
        .single();
      
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
