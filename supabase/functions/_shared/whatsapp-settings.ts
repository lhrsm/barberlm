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

export async function sendMessage(connection: any, phone: string, message: string) {
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

    const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
    
    const response = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: targetPhone, message: message })
    });

    const data = await response.json();
    
    return { 
      success: response.ok, 
      response: data, 
      error: !response.ok ? (data.message || data.error || `HTTP ${response.status}`) : null 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
