import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getWhatsAppSettings, sendMessage } from "../_shared/whatsapp-settings.ts";
import { normalizePhone } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function extractPhone(body: any): string {
  const possiblePaths = [
    body.phone, body.from, body.sender, body.message?.phone, 
    body.message?.from, body.data?.phone, body.data?.from, 
    body.chatId, body.key?.remoteJid
  ];
  for (const val of possiblePaths) {
    if (val && typeof val === 'string') {
      let phone = val.split('@')[0].replace(/\D/g, "");
      if (phone.length >= 10) return phone;
    }
  }
  return "";
}

function extractOption(body: any): string {
  const paths = [
    body.buttonReply?.id, body.buttonReply?.title,
    body.buttonsResponseMessage?.selectedButtonId,
    body.listResponseMessage?.singleSelectReply?.selectedRowId,
    body.text, body.body, body.message?.text
  ];
  for (const val of paths) {
    if (val) return String(val).trim();
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
    const body = await req.json();
    console.log('--- DEBUG WEBHOOK RECEIVED ---');
    console.log(JSON.stringify(body));

    const phone = extractPhone(body);
    const normalizedPhone = normalizePhone(phone);
    const option = extractOption(body);
    const type = body.type || 'unknown';

    // Save to logs as requested
    await supabase.from("zapi_webhook_logs").insert({
      payload: body,
      extracted_phone: normalizedPhone,
      extracted_option: option,
      type: type,
      phone: normalizedPhone,
      event_type: type,
      selected_option: option
    });

    // Send fixed response
    if (normalizedPhone) {
      // Try to find any instance to send from
      const { data: instance } = await supabase.from("whatsapp_instances").select("*").eq("status", "connected").limit(1).maybeSingle();
      if (instance) {
        await sendMessage(instance, normalizedPhone, "✅ Webhook recebido pelo BarberLM.");
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook received by BarberLM" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Debug Webhook Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
