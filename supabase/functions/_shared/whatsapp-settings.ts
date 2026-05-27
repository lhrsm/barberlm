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

export interface ZApiOption {
  id: string;
  title: string;
  description?: string;
}

export async function sendMessage(
  connection: any, 
  phone: string, 
  message: string, 
  options?: { 
    buttons?: ZApiButton[], 
    title?: string, 
    footer?: string,
    list?: {
      buttonLabel: string;
      title: string;
      options: ZApiOption[];
    }
  }
) {
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

  console.log('SENDING MESSAGE TO:', targetPhone);
  
  // 1. Try sending as List if provided
  if (options?.list && options.list.options.length > 0) {
    const listPayload = {
      phone: targetPhone,
      message: message,
      optionList: {
        title: options.list.title,
        buttonLabel: options.list.buttonLabel,
        options: options.list.options.map(o => ({
          id: o.id,
          title: o.title,
          description: o.description || ""
        }))
      }
    };

    console.log('LIST PAYLOAD:', JSON.stringify(listPayload));

    try {
      const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-option-list`;
      const response = await fetch(sendUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(listPayload)
      });

      const data = await response.json();
      console.log('LIST SEND RESULT:', JSON.stringify(data));

      if (response.ok) return { success: true, response: data, error: null };
      console.log('LIST SEND ERROR (API):', data.message || data.error);
    } catch (error) {
      console.log('LIST SEND ERROR (Fetch):', error.message);
    }
  }

  // 2. Try sending as Buttons if provided
  if (options?.buttons && options.buttons.length > 0) {
    const buttonsPayload = {
      phone: targetPhone,
      message: message,
      buttonList: {
        buttons: options.buttons.map(b => ({
          id: b.id,
          label: b.label
        }))
      }
    };

    console.log('BUTTONS PAYLOAD:', JSON.stringify(buttonsPayload));

    try {
      const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-button-list`;
      const response = await fetch(sendUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(buttonsPayload)
      });

      const data = await response.json();
      console.log('BUTTONS SEND RESULT:', JSON.stringify(data));

      if (response.ok) return { success: true, response: data, error: null };
      console.log('BUTTONS SEND ERROR (API):', data.message || data.error);
    } catch (error) {
      console.log('BUTTONS SEND ERROR (Fetch):', error.message);
    }
  }

  // 3. Fallback or standard text message
  console.log('SENDING STANDARD TEXT MESSAGE (OR FALLBACK)');
  try {
    const sendUrl = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
    const response = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: targetPhone, message })
    });

    const data = await response.json();
    console.log('TEXT SEND RESULT:', JSON.stringify(data));
    
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

