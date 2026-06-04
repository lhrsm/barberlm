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
    // 1. Get Template
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      console.log(`[WhatsApp] No active template found for ${eventType} and user ${userId}`);
      return { success: false, error: "Template not found" };
    }

    // 2. Parse placeholders
    let content = template.content;
    Object.keys(placeholders).forEach(key => {
      content = content.replace(new RegExp(`{{${key}}}`, "g"), placeholders[key]);
    });

    // 3. Prepare Buttons for confirmation
    const options: any = {};
    if (eventType === 'appointment_confirmation') {
      options.buttons = [
        { id: "main_confirm", label: "Confirmar agendamento" }
      ];
    }

    // 4. Send via Edge Function (functional version)
    const { data, error } = await supabase.functions.invoke('whatsapp-cloud', {
      body: {
        user_id: userId,
        phone,
        content,
        options,
        metadata: { eventType, appointmentId }
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

