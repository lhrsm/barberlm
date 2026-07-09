import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/utils.ts";
import { sendAutomationMessageV2 } from "../_shared/automation-v2-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


serve(async (req) => {
  console.log('EDGE FUNCTION STARTED: whatsapp-cloud');
  console.log('REQUEST METHOD:', req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }


  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  if (url.pathname.endsWith("/process-queue")) {
    // Atomically claim pending messages so parallel /process-queue invocations
    // don't each pick up the same rows and double-send. Flip status → 'sending'
    // and only process the rows we actually claimed via RETURNING.
    const { data: candidates } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(20);

    const candidateIds = (candidates || []).map((c: any) => c.id);
    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({ message: "No pending messages" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: claimed } = await supabase
      .from("whatsapp_messages")
      .update({ status: "sending" })
      .in("id", candidateIds)
      .eq("status", "pending")
      .select("*, whatsapp_instances(*)");

    const pendingMessages = claimed || [];
    if (pendingMessages.length === 0) {
      return new Response(JSON.stringify({ message: "No pending messages (all claimed by another worker)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    for (const msg of pendingMessages) {
      const conn = msg.whatsapp_instances;
      if (!conn) {
        await supabase.from("whatsapp_messages").update({ status: "failed", error_message: "No instance found" }).eq("id", msg.id);
        continue;
      }

      try {
        const targetPhone = normalizePhone(msg.metadata?.phone || msg.wa_id);
        
        if (conn.provider === 'z-api') {
          const baseUrl = conn.server_url || "https://api.z-api.io";
          console.log(`[Z-API] Sending via ${baseUrl} to ${targetPhone}`);

          const options = msg.metadata?.options || {};
          
          const sendResult = await sendAutomationMessageV2(supabase, {
            tenant_id: msg.user_id,
            workflow_key: msg.metadata?.workflow_key || 'manual_message',
            customer_phone: targetPhone,
            message: msg.content,
            buttons: options.buttons,
            instance: conn,
            payload: { message_id_v1: msg.id, metadata: msg.metadata }
          });

          if (sendResult.success) {
            await supabase.from("whatsapp_messages").update({ 
              status: "sent", 
              wa_id: sendResult.provider_message_id
            }).eq("id", msg.id);
            
            results.push({ id: msg.id, result: sendResult });
          } else {
            await supabase.from("whatsapp_messages").update({ 
              status: "failed", 
              error_message: sendResult.error
            }).eq("id", msg.id);
            results.push({ id: msg.id, error: sendResult.error });
          }
        }
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err.message);
        results.push({ id: msg.id, error: err.message });
        await supabase.from("whatsapp_messages").update({ 
          status: "failed", 
          error_message: err.message
        }).eq("id", msg.id);
      }
    }

    return new Response(JSON.stringify({ processed: pendingMessages.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method === "POST" && (url.pathname.endsWith("/send") || url.pathname.endsWith("/whatsapp-cloud") || url.pathname === "/whatsapp-cloud" || url.pathname.endsWith("/whatsapp-cloud/"))) {
    const body = await req.json();
    // Support both direct send (V1) and template-based send (V1.5)
    const { user_id, phone, content, options, metadata } = body;

    if (!user_id || !phone) {
      return new Response(JSON.stringify({ error: "user_id and phone are required" }), { status: 400, headers: corsHeaders });
    }

    const { data: activeInstance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", user_id)
      .eq("connected", true)
      .maybeSingle();

    if (!activeInstance) {
      return new Response(JSON.stringify({ error: "Nenhuma instância ativa do WhatsApp encontrada para este tenant." }), { status: 404, headers: corsHeaders });
    }

    // Determine content: direct content or template-based logic (which is now handled in frontend utility)
    const finalContent = content || "Olá!";

    const { data: message, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id,
        connection_id: activeInstance.id,
        type: "sent",
        status: "pending",
        content: finalContent,
        metadata: { phone, options, ...metadata },
        scheduled_for: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }

    // Trigger immediate processing
    fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud/process-queue`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supabaseKey}` }
    }).catch(e => console.error("Error triggering queue:", e));
    
    return new Response(JSON.stringify({ success: true, message_id: message.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response("Not Found", { status: 404 });
});
