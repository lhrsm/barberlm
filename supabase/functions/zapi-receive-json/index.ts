import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, client-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // 1. Handle CORS OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const url = new URL(req.url);
  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  const contentType = headers["content-type"] || "";

  // GET response for basic health check
  if (method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      message: "Z-API receive JSON webhook is active"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let rawBody = "";
  let body: any = null;

  // 2. Extract Body (Safely)
  try {
    const buffer = await req.arrayBuffer();
    rawBody = new TextDecoder().decode(buffer);
    
    if (contentType.includes("application/json") && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error("[zapi-receive-json] JSON parse error:", e);
      }
    }
  } catch (e) {
    console.error("[zapi-receive-json] Error reading body:", e);
  }

  // Fallback for non-JSON or empty body
  if (!body) body = { raw: rawBody };

  // 3. Save RAW payload immediately
  try {
    const { error: debugError } = await supabase
      .from("zapi_webhook_debug")
      .insert({
        method,
        url: req.url,
        content_type: contentType,
        headers_raw: headers,
        payload_raw: body,
        raw_body: rawBody,
        source: "zapi_real",
        received_at: new Date().toISOString(),
        processed: false
      });

    if (debugError) {
      console.error("[zapi-receive-json] Error saving debug log:", debugError);
    }
  } catch (e) {
    console.error("[zapi-receive-json] Critical Error saving debug log:", e);
  }

  // 4. Return success response to Z-API immediately
  return new Response(JSON.stringify({ 
    ok: true, 
    received: true
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
