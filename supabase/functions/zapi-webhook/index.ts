import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizePhone } from "../_shared/utils.ts";
import { FLOW_TYPES } from "../_shared/automation-engine.ts";
import { handleSingleFlowResponse } from "./handlers/single-response.ts";
import { handleMultiFlowResponse } from "./handlers/multi-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function extractPhoneFromZapiPayload(body: any): string {
  const possiblePaths = [
    body.phone, body.from, body.sender, body.message?.phone,
    body.message?.from, body.chatId, body.key?.remoteJid, body.participant
  ];
  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      let phone = val.split('@')[0].replace(/\D/g, "");
      if (phone.length >= 10 && phone.length <= 15) return phone;
    }
  }
  return "";
}

function extractSelectedOption(body: any): string {
  // Check specific Z-API button response fields
  if (body.type === "ReceivedCallback") {
    if (body.buttonsResponseMessage?.buttonId) return body.buttonsResponseMessage.buttonId;
    if (body.listResponseMessage?.singleSelectReply?.selectedRowId) return body.listResponseMessage.singleSelectReply.selectedRowId;
  }
  
  const possiblePaths = [
    body.buttonsResponseMessage?.buttonId,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.buttonReply?.id,
    body.selectedRowId,
    body.text?.message || body.text || body.body || body.message?.text
  ];
  for (const val of possiblePaths) {
    if (val !== undefined && val !== null && val !== '') return String(val).trim();
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return new Response(JSON.stringify({ error: "Missing tenantId" }), { status: 400, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    
    // Ignore sent messages
    if (body.fromMe === true) return new Response(JSON.stringify({ success: true, ignored: true }), { headers: corsHeaders });

    const phone = extractPhoneFromZapiPayload(body);
    const normalizedPhone = normalizePhone(phone);
    const buttonId = extractSelectedOption(body);
    const referenceMessageId = body.referenceMessageId;

    console.log(`[Webhook] From: ${normalizedPhone}, Button: ${buttonId}, Ref: ${referenceMessageId}`);

    // 1. Find Session
    let session = null;
    if (referenceMessageId) {
      const { data } = await supabase.from("conversation_sessions").select("*").eq("tenant_id", tenantId).eq("provider_message_id", referenceMessageId).maybeSingle();
      session = data;
    }
    if (!session && normalizedPhone) {
      const { data } = await supabase.from("conversation_sessions").select("*").eq("tenant_id", tenantId).eq("phone", normalizedPhone).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
      session = data;
    }

    // 2. Log Webhook
    const { data: logData } = await supabase.from("zapi_webhook_logs").insert({
      tenant_id: tenantId,
      payload: body,
      phone: normalizedPhone,
      button_id: buttonId,
      reference_message_id: referenceMessageId,
      session_id: session?.id,
      flow_type: session?.flow_type,
      processed: !!session
    }).select().single();

    if (!session) {
      return new Response(JSON.stringify({ success: true, message: "No session found" }), { headers: corsHeaders });
    }

    // 3. Dispatch to Flow Handlers
    let result;
    const stepBefore = session.current_step;
    
    if (session.flow_type === FLOW_TYPES.MULTI) {
      result = await handleMultiFlowResponse(supabase, session, buttonId, normalizedPhone);
    } else {
      result = await handleSingleFlowResponse(supabase, session, buttonId, normalizedPhone);
    }

    // 4. Automation Log
    await supabase.from("automation_logs").insert({
      tenant_id: tenantId,
      session_id: session.id,
      flow_type: session.flow_type,
      current_step_before: stepBefore,
      current_step_after: (await supabase.from("conversation_sessions").select("current_step").eq("id", session.id).single()).data?.current_step,
      selected_option: buttonId,
      action: result?.action || 'processed_webhook',
      status: result?.error ? 'error' : 'success',
      message: result?.error || 'Webhook processado com sucesso',
      error: result?.error
    });

    return new Response(JSON.stringify({ success: true, result }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});
