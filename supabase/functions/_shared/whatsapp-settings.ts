import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export async function getWhatsAppSettings(supabase: any, tenantId: string) {
  const { data: connection, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !connection) return null;
  return connection;
}

export interface ZApiButton {
  id: string;
  label: string;
}

export async function sendMessage(connection: any, phone: string, message: string, options?: { buttons?: ZApiButton[], title?: string, footer?: string }) {
  try {
    const instanceId = connection.instance_id;
    const token = connection.token;
    const clientToken = connection.client_token;
    const baseUrl = connection.server_url || "https://api.z-api.io";
    
    // Normalize phone (remove non-digits, ensure 55 prefix)
    let targetPhone = phone.replace(/\D/g, "");
    if (targetPhone.length === 10 || targetPhone.length === 11) {
      targetPhone = "55" + targetPhone;
    }

    const headers: any = { "Content-Type": "application/json" };
    if (clientToken) {
      headers["Client-Token"] = clientToken;
    }

    let sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
    let body: any = { phone: targetPhone, message };

    // If buttons are provided, use the button-list endpoint
    if (options?.buttons && options.buttons.length > 0) {
      sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-button-list`;
      body = {
        phone: targetPhone,
        message: message,
        title: options.title || "",
        footer: options.footer || "",
        buttons: options.buttons.map(b => ({
          id: b.id,
          label: b.label
        }))
      };
    }
    
    console.log(`[Z-API] Sending to ${targetPhone} via ${sendUrl}`);

    const response = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log(`[Z-API] Response from ${targetPhone}:`, JSON.stringify(data));
    
    return { 
      success: response.ok, 
      response: data, 
      error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null 
    };
  } catch (error) {
    console.error(`[Z-API] Fatal error sending to ${phone}:`, error);
    return { success: false, error: error.message };
  }
}
