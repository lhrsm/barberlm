import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendMessage } from "./whatsapp-settings.ts";

export interface AutomationMessageV2Params {
  tenant_id: string;
  workflow_key: string;
  flow_type?: 'single' | 'sequential';
  appointment_id?: string;
  appointment_group_id?: string;
  customer_id?: string;
  customer_phone: string;
  customer_name?: string;
  message: string;
  buttons?: any[];
  payload?: any;
  instance?: any;
}

export async function sendAutomationMessageV2(supabase: any, params: AutomationMessageV2Params) {
  const {
    tenant_id,
    workflow_key,
    flow_type = 'single',
    appointment_id,
    appointment_group_id,
    customer_id,
    customer_phone,
    customer_name,
    message,
    buttons,
    payload = {}
  } = params;

  let instance = params.instance;
  if (!instance) {
    const { data: instData } = await supabase.from("whatsapp_instances").select("*").eq("tenant_id", tenant_id).maybeSingle();
    instance = instData;
  }

  if (!instance) {
    console.error(`[AutomationV2] No WhatsApp instance for tenant ${tenant_id}`);
    throw new Error("WhatsApp not configured for this tenant");
  }

  // 1. Send via WhatsApp
  const sendOptions: any = {};
  if (buttons && buttons.length > 0) {
    sendOptions.buttons = buttons.map((b: any, index: number) => ({
      id: b.id || `button_${index}`,
      label: b.label || b.text
    }));
  }

  const sendResult = await sendMessage(instance, customer_phone, message, sendOptions);

  if (!sendResult.success) {
    console.error(`[AutomationV2] WhatsApp send failed:`, sendResult.error);
    await supabase.from("automation_v2_logs").insert({
      tenant_id,
      appointment_id,
      level: 'error',
      message: 'Falha no envio do WhatsApp',
      context: { error: sendResult.error, phone: customer_phone, workflow_key }
    });
    return { success: false, error: sendResult.error };
  }

  const providerMessageId = sendResult.response?.messageId || sendResult.response?.id;

  // 2. Create session if it's a flow that expects response
  let session_id = null;
  const isConfirmation = workflow_key === 'appointment_confirmation' || (buttons && buttons.length > 0);
  
  if (isConfirmation) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const { data: session, error: sessError } = await supabase.from("automation_v2_sessions").insert({
      tenant_id,
      customer_id,
      phone: customer_phone,
      flow_type,
      current_step: "AWAITING_MAIN_ACTION",
      status: "active",
      appointment_id,
      appointment_group_id,
      provider_message_id: providerMessageId,
      expires_at: expiresAt.toISOString(),
      context: { workflow_key, payload }
    }).select().single();

    if (!sessError) session_id = session.id;
    else console.error("[AutomationV2] Session creation error:", sessError);
  }

  // 3. Create dispatch (V2)
  const { data: dispatch, error: dispatchError } = await supabase.from("automation_v2_dispatches").insert({
    tenant_id,
    appointment_id,
    appointment_group_id,
    customer_id,
    customer_phone,
    workflow_key,
    flow_type,
    phone: customer_phone,
    customer_name,
    channel: 'whatsapp',
    message_id: providerMessageId,
    provider_message_id: providerMessageId,
    zaap_id: instance.instance_id,
    status: "sent",
    sent_at: new Date().toISOString(),
    payload: { ...payload, rendered_message: message },
    provider_response: sendResult.response,
    session_id: session_id,
    current_step: "AWAITING_MAIN_ACTION",
    callback_received: false
  }).select().single();

  if (dispatchError) {
    console.error(`[AutomationV2] CRITICAL: Dispatch creation failed:`, dispatchError);
    
    // Log critical error
    await supabase.from("automation_v2_logs").insert({
      tenant_id,
      appointment_id,
      level: 'error',
      message: 'WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED',
      context: { error: dispatchError, provider_message_id: providerMessageId }
    });

    // Mark automation as not healthy for this tenant
    try {
      await supabase.from("automation_templates")
        .update({ is_healthy: false, last_error: 'WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED' })
        .eq("tenant_id", tenant_id)
        .eq("key", workflow_key);
    } catch (e) {
      console.error("[AutomationV2] Error updating health status:", e);
    }

    return { 
      success: true, 
      warning: "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED", 
      error: dispatchError.message,
      provider_message_id,
      session_id
    };
  }

  // 4. Log Success
  await supabase.from("automation_v2_logs").insert({
    tenant_id,
    appointment_id,
    level: 'info',
    message: `Mensagem enviada via ${workflow_key}`,
    context: { dispatch_id: dispatch.id, provider_message_id: providerMessageId }
  });

  return {
    success: true,
    dispatch_id: dispatch.id,
    provider_message_id: providerMessageId,
    session_id
  };
}
