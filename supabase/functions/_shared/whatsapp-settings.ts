import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export async function getWhatsAppSettings(supabase: any, barberId: string) {
  console.log(`[WhatsApp Settings] Fetching settings for barber ${barberId}`);
  
  const { data: settings, error } = await supabase
    .from("barbershop_settings")
    .select("*")
    .eq("barber_id", barberId)
    .maybeSingle();

  if (error) {
    console.error(`[WhatsApp Settings] Error:`, error);
  }

  // Debug as requested
  if (settings) {
    console.log('--- SETTINGS FOUND ---');
    console.log('BARBER ID:', barberId);
    console.log('INSTANCE ID:', settings.instance_id);
    console.log('INSTANCE TOKEN:', settings.instance_token ? '***' : 'MISSING');
    console.log('CLIENT TOKEN:', settings.client_token ? '***' : 'MISSING');
    console.log('WHATSAPP NUMBER:', settings.whatsapp_number);
    console.log('----------------------');
  } else {
    console.warn(`[WhatsApp Settings] No settings found for barber ${barberId}`);
  }

  return settings;
}
